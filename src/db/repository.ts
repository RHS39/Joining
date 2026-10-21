/**
 * Repository layer: every read and write against the local IndexedDB database.
 *
 * Record + image writes that must succeed or fail together are executed inside
 * Dexie transactions.
 */
import { db } from './db';
import type {
  AppPreferences,
  DataRecord,
  FieldDefinition,
  FieldValue,
  ImageAttachment,
  RecordFilters,
  RecordInput,
  SettingsBundle,
  SortKey,
} from '@/types';
import { createId, employeeNumberFromId, formatEmployeeId, nowIso } from '@/lib/id';
import type { ProcessedImage } from '@/lib/image';
import type { ImportPlan, ParsedImportRow } from '@/lib/import';
import {
  applyRenamedFields,
  createDefaultCustomFields,
  hasRenamedField,
  isOutdatedTemplate,
  JOINING_FORM_TEMPLATE,
  RENAMED_FIELD_KEYS,
} from '@/lib/templates';

/** Employee categories used until the user defines their own. */
export const DEFAULT_CATEGORIES = ['Casual', 'Piece Rate'];

export const DEFAULT_PREFERENCES: AppPreferences = {
  appTitle: 'Kores Employee Records',
  organisation: 'PEFCO FOUNDRY DIVISION (BHOSARI)',
  currency: 'INR',
  footerNote: '',
  defaultPageSize: 'A4',
  defaultOrientation: 'portrait',
  showImagesInReports: true,
  // A personnel register has no quantity or price.
  showQuantities: false,
  defaultCategory: 'Casual',
};

const SETTINGS_KEY_CATEGORIES = 'categories';
const SETTINGS_KEY_CUSTOM_FIELDS = 'customFields';
const SETTINGS_KEY_PREFERENCES = 'preferences';

/* --------------------------------------------------------------- settings */

export async function getSettings(): Promise<SettingsBundle> {
  const rows = await db.settings.toArray();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const preferences = (map.get(SETTINGS_KEY_PREFERENCES) ?? {}) as Partial<AppPreferences>;
  const storedFields = map.get(SETTINGS_KEY_CUSTOM_FIELDS) as FieldDefinition[] | undefined;
  const storedCategories = map.get(SETTINGS_KEY_CATEGORIES) as string[] | undefined;

  // The shipped field list was changed: an older version of the template is
  // replaced by the current one, together with its categories. The values
  // that are already stored in the records are kept.
  const outdated = storedFields ? isOutdatedTemplate(storedFields, storedCategories ?? []) : false;

  const merged: AppPreferences = { ...DEFAULT_PREFERENCES, ...preferences };
  if (outdated) {
    merged.defaultCategory = JOINING_FORM_TEMPLATE.preferences?.defaultCategory ?? merged.defaultCategory;
  }
  if (!merged.defaultCategory) merged.defaultCategory = DEFAULT_PREFERENCES.defaultCategory;

  return {
    categories: outdated
      ? [...(JOINING_FORM_TEMPLATE.categories ?? DEFAULT_CATEGORIES)]
      : (storedCategories ?? [...DEFAULT_CATEGORIES]),
    // A field that was renamed is shown with its new name, even when the
    // stored list has not been rewritten yet.
    customFields: outdated ? createDefaultCustomFields() : applyRenamedFields(storedFields ?? createDefaultCustomFields()),
    preferences: merged,
  };
}

export async function saveSettingsBundle(bundle: SettingsBundle): Promise<void> {
  const now = nowIso();
  await db.transaction('rw', db.settings, async () => {
    await db.settings.bulkPut([
      { key: SETTINGS_KEY_CATEGORIES, value: bundle.categories, updatedAt: now },
      { key: SETTINGS_KEY_CUSTOM_FIELDS, value: bundle.customFields, updatedAt: now },
      { key: SETTINGS_KEY_PREFERENCES, value: bundle.preferences, updatedAt: now },
    ]);
  });
}

export async function saveCategories(categories: string[]): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY_CATEGORIES, value: categories, updatedAt: nowIso() });
}

export async function saveCustomFields(customFields: FieldDefinition[]): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY_CUSTOM_FIELDS, value: customFields, updatedAt: nowIso() });
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY_PREFERENCES, value: preferences, updatedAt: nowIso() });
}

/**
 * Move the data of the renamed fields to their new key: the stored field
 * list takes the definition of the template and the values of the records
 * move from the old key to the new one. A record never loses a value.
 *
 * The number of the migrated records is returned.
 */
export async function migrateRenamedFields(): Promise<number> {
  const stored = await db.settings.get(SETTINGS_KEY_CUSTOM_FIELDS);
  const fields = stored?.value as FieldDefinition[] | undefined;

  if (fields && hasRenamedField(fields)) {
    await saveCustomFields(applyRenamedFields(fields));
  }

  const records = await db.records.toArray();
  const migrated: DataRecord[] = [];

  records.forEach((record) => {
    const custom: Record<string, FieldValue> = { ...record.custom };
    let changed = false;

    Object.entries(RENAMED_FIELD_KEYS).forEach(([oldKey, newKey]) => {
      if (!(oldKey in custom)) return;
      const value = custom[oldKey];
      delete custom[oldKey];
      // A value that already stands under the new key wins.
      if (custom[newKey] === undefined || custom[newKey] === null) custom[newKey] = value;
      changed = true;
    });

    if (changed) migrated.push({ ...record, custom });
  });

  if (migrated.length > 0) {
    await db.transaction('rw', db.records, async () => {
      await db.records.bulkPut(migrated);
    });
  }

  return migrated.length;
}

/* ---------------------------------------------------------------- records */

export async function listRecords(): Promise<DataRecord[]> {
  return db.records.toArray();
}

export async function countRecords(): Promise<number> {
  return db.records.count();
}

export async function getRecord(id: string): Promise<DataRecord | undefined> {
  return db.records.get(id);
}

export async function getRecordByRecordId(recordId: string): Promise<DataRecord | undefined> {
  return db.records.where('recordId').equals(recordId).first();
}

export async function getExistingRecordIds(): Promise<Set<string>> {
  const records = await db.records.toArray();
  return new Set(records.map((record) => record.recordId));
}

/** Compute the total amount of a record (quantity x unit price). */
export function computeTotal(input: Pick<RecordInput, 'quantity' | 'unitPrice'>): number | null {
  if (input.quantity === null || input.unitPrice === null) return null;
  if (Number.isNaN(input.quantity) || Number.isNaN(input.unitPrice)) return null;
  return Math.round(input.quantity * input.unitPrice * 100) / 100;
}

/** Create a record (and optionally its image) atomically. */
export async function createRecord(input: RecordInput, image?: ProcessedImage | null): Promise<DataRecord> {
  const now = nowIso();
  const record: DataRecord = {
    id: createId(),
    recordId: input.recordId.trim(),
    date: input.date,
    title: input.title.trim(),
    category: input.category.trim(),
    description: (input.description ?? '').trim(),
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    totalAmount: computeTotal(input),
    hasImage: Boolean(image),
    custom: input.custom ?? {},
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.records, db.images, async () => {
    await db.records.add(record);
    if (image) {
      await db.images.put({
        recordKey: record.id,
        blob: image.blob,
        mimeType: image.mimeType,
        fileName: image.fileName,
        size: image.size,
        width: image.width,
        height: image.height,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  return record;
}

export interface UpdateRecordOptions {
  /** Replacement image. */
  image?: ProcessedImage | null;
  /** Remove the existing image. */
  removeImage?: boolean;
}

/** Update a record (and optionally its image) atomically. */
export async function updateRecord(
  id: string,
  input: RecordInput,
  options: UpdateRecordOptions = {},
): Promise<DataRecord | undefined> {
  const now = nowIso();

  return db.transaction('rw', db.records, db.images, async () => {
    const existing = await db.records.get(id);
    if (!existing) return undefined;

    const updated: DataRecord = {
      ...existing,
      recordId: input.recordId.trim(),
      date: input.date,
      title: input.title.trim(),
      category: input.category.trim(),
      description: (input.description ?? '').trim(),
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalAmount: computeTotal(input),
      custom: input.custom ?? {},
      updatedAt: now,
    };

    let hasImage = existing.hasImage;
    if (options.image) {
      await db.images.put({
        recordKey: existing.id,
        blob: options.image.blob,
        mimeType: options.image.mimeType,
        fileName: options.image.fileName,
        size: options.image.size,
        width: options.image.width,
        height: options.image.height,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
      hasImage = true;
    } else if (options.removeImage) {
      await db.images.delete(existing.id);
      hasImage = false;
    }
    updated.hasImage = hasImage;

    await db.records.put(updated);
    return updated;
  });
}

/** Delete records together with their images. */
export async function deleteRecords(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return db.transaction('rw', db.records, db.images, async () => {
    await db.images.bulkDelete(ids);
    await db.records.bulkDelete(ids);
    return ids.length;
  });
}

/**
 * The Employee ID of a new employee: the next number of the sequence.
 *
 * The count starts after the highest number that is in use — `EMP-0136` is
 * followed by `EMP-0137`. An identifier that does not carry a number (an id
 * of an older version, an id that was typed by hand) does not take part in
 * the count.
 */
export async function generateUniqueRecordId(): Promise<string> {
  const records = await db.records.toArray();
  const used = new Set(records.map((record) => record.recordId));

  let highest = 0;
  records.forEach((record) => {
    const number = employeeNumberFromId(record.recordId);
    if (number !== null && number > highest) highest = number;
  });

  let number = highest + 1;
  while (used.has(formatEmployeeId(number))) number += 1;

  return formatEmployeeId(number);
}

/* ----------------------------------------------------------------- images */

export async function getImage(recordKey: string): Promise<ImageAttachment | undefined> {
  return db.images.get(recordKey);
}

export async function getImagesForRecords(recordKeys: string[]): Promise<Map<string, ImageAttachment>> {
  const result = new Map<string, ImageAttachment>();
  if (recordKeys.length === 0) return result;
  const rows = await db.images.bulkGet(recordKeys);
  rows.forEach((row) => {
    if (row) result.set(row.recordKey, row);
  });
  return result;
}

export async function deleteImage(recordKey: string): Promise<void> {
  await db.transaction('rw', db.records, db.images, async () => {
    await db.images.delete(recordKey);
    const record = await db.records.get(recordKey);
    if (record?.hasImage) {
      await db.records.update(recordKey, { hasImage: false, updatedAt: nowIso() });
    }
  });
}

export async function getAllImages(): Promise<ImageAttachment[]> {
  return db.images.toArray();
}

/* --------------------------------------------------- query / filter / sort */

function matchesSearch(record: DataRecord, search: string): boolean {
  if (!search) return true;
  return (
    record.recordId.toLowerCase().includes(search) ||
    record.title.toLowerCase().includes(search) ||
    record.description.toLowerCase().includes(search)
  );
}

function matchesFilters(record: DataRecord, filters: RecordFilters): boolean {
  if (filters.category && record.category !== filters.category) return false;
  if (filters.dateFrom && record.date < filters.dateFrom) return false;
  if (filters.dateTo && record.date > filters.dateTo) return false;
  if (!matchesSearch(record, filters.search.trim().toLowerCase())) return false;
  return true;
}

function compareValues(a: DataRecord, b: DataRecord, key: SortKey): number {
  switch (key) {
    case 'quantity':
    case 'unitPrice':
    case 'totalAmount': {
      const left = a[key];
      const right = b[key];
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
    default: {
      const left = String(a[key] ?? '').toLowerCase();
      const right = String(b[key] ?? '').toLowerCase();
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    }
  }
}

/** Apply filters + sorting in memory (used by the table, the reports and the exporter). */
export function sortAndFilter(
  records: DataRecord[],
  filters: RecordFilters,
  sortKey: SortKey = 'date',
  direction: 'asc' | 'desc' = 'desc',
): DataRecord[] {
  const filtered = records.filter((record) => matchesFilters(record, filters));
  const factor = direction === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const result = compareValues(a, b, sortKey);
    if (result !== 0) return result * factor;
    return a.recordId.localeCompare(b.recordId, undefined, { numeric: true });
  });
  return filtered;
}

/**
 * Query the database. Indexed lookups are used for the category and the date
 * range whenever possible, the remaining predicates are applied in memory.
 */
export async function queryRecords(
  filters: RecordFilters,
  sortKey: SortKey = 'date',
  direction: 'asc' | 'desc' = 'desc',
): Promise<DataRecord[]> {
  let rows: DataRecord[];
  if (filters.category) {
    rows = await db.records.where('category').equals(filters.category).toArray();
  } else if (filters.dateFrom && filters.dateTo) {
    rows = await db.records.where('date').between(filters.dateFrom, filters.dateTo, true, true).toArray();
  } else if (filters.dateFrom) {
    rows = await db.records.where('date').aboveOrEqual(filters.dateFrom).toArray();
  } else if (filters.dateTo) {
    rows = await db.records.where('date').belowOrEqual(filters.dateTo).toArray();
  } else {
    rows = await db.records.toArray();
  }
  return sortAndFilter(rows, filters, sortKey, direction);
}

/* ------------------------------------------------------------ bulk import */

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

async function insertRows(rows: ParsedImportRow[]): Promise<number> {
  let inserted = 0;
  const now = nowIso();
  for (const row of rows) {
    const record: DataRecord = {
      id: createId(),
      recordId: row.input.recordId,
      date: row.input.date,
      title: row.input.title,
      category: row.input.category,
      description: row.input.description,
      quantity: row.input.quantity,
      unitPrice: row.input.unitPrice,
      totalAmount: computeTotal(row.input),
      hasImage: false,
      custom: row.input.custom,
      createdAt: now,
      updatedAt: now,
    };
    await db.records.add(record);
    inserted += 1;
  }
  return inserted;
}

async function updateRows(rows: ParsedImportRow[]): Promise<number> {
  let updated = 0;
  const now = nowIso();
  for (const row of rows) {
    const existing = await db.records.where('recordId').equals(row.input.recordId).first();
    if (!existing) continue;

    const custom = { ...existing.custom };
    Object.entries(row.input.custom ?? {}).forEach(([key, value]) => {
      if (!isEmptyValue(value)) custom[key] = value;
    });

    const merged: RecordInput = {
      recordId: existing.recordId,
      date: isEmptyValue(row.input.date) ? existing.date : row.input.date,
      title: isEmptyValue(row.input.title) ? existing.title : row.input.title,
      category: isEmptyValue(row.input.category) ? existing.category : row.input.category,
      description: isEmptyValue(row.input.description) ? existing.description : row.input.description,
      quantity: row.input.quantity === null ? existing.quantity : row.input.quantity,
      unitPrice: row.input.unitPrice === null ? existing.unitPrice : row.input.unitPrice,
      custom,
    };

    await db.records.put({
      ...existing,
      ...merged,
      totalAmount: computeTotal(merged),
      // Images and creation timestamp are never touched by an import.
      hasImage: existing.hasImage,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
    updated += 1;
  }
  return updated;
}

/**
 * Apply a confirmed import plan inside a single transaction so a failure cannot
 * leave the database half written.
 */
export async function applyImportPlan(plan: ImportPlan): Promise<{ inserted: number; updated: number }> {
  return db.transaction('rw', db.records, async () => {
    const inserted = await insertRows(plan.inserts);
    const updated = await updateRows(plan.updates);
    return { inserted, updated };
  });
}

/* ------------------------------------------------------------- maintenance */

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.records, db.images, db.settings, async () => {
    await db.records.clear();
    await db.images.clear();
    await db.settings.clear();
  });
}
