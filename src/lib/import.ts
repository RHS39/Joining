/**
 * Import pipeline: turn raw spreadsheet rows into a validated, reviewable plan.
 *
 * The pipeline is deliberately split in two:
 *   1. `buildImportPlan` — pure, produces a preview the user must confirm.
 *   2. `applyImportPlan`  — writes the confirmed plan inside a Dexie transaction.
 */
import type { FieldDefinition, FieldValue, RecordInput } from '@/types';
import { customFieldKeyFromColumn, getAllColumns, isCustomColumn, type ColumnType, type FieldColumn } from './columns';
import { buildRecordSchema, isValidIsoDate } from './validation';

/** How the importer should treat records whose Record ID already exists. */
export type ImportStrategy = 'insert-only' | 'update-only' | 'merge';

export const IMPORT_STRATEGIES: { value: ImportStrategy; label: string; description: string }[] = [
  {
    value: 'insert-only',
    label: 'Add new employees only',
    description:
      'Creates employee records that do not exist yet. Rows whose Employee ID already exists are skipped and reported as conflicts — nothing is overwritten.',
  },
  {
    value: 'update-only',
    label: 'Update existing employees only',
    description:
      'Updates employee records whose Employee ID already exists. Rows without a matching employee are skipped and reported. Existing photos are preserved.',
  },
  {
    value: 'merge',
    label: 'Merge new and existing employees',
    description:
      'Updates matching employee records and creates the rest. For a matched employee an imported value overwrites the stored value only when the imported cell is not empty; fields missing from the spreadsheet stay unchanged. Existing photos are preserved.',
  },
];

/** Mapping of application column key -> index of the spreadsheet header. */
export type ImportMapping = Record<string, number | undefined>;

export interface ParsedImportRow {
  rowNumber: number;
  recordId: string;
  input: RecordInput;
  values: Record<string, FieldValue>;
}

export interface RejectedRow {
  rowNumber: number;
  reason: string;
  raw: Record<string, unknown>;
}

export interface ImportPlan {
  /** Number of data rows found in the file. */
  total: number;
  /** Rows that passed validation. */
  valid: number;
  /** Rows that failed validation. */
  rejected: RejectedRow[];
  /** Rows repeated inside the same file (the last occurrence wins). */
  duplicates: RejectedRow[];
  /** Rows that will be inserted. */
  inserts: ParsedImportRow[];
  /** Rows that will update an existing record. */
  updates: ParsedImportRow[];
  /** Rows excluded by the chosen strategy. */
  skipped: RejectedRow[];
}

/** Convert a `Date` into a local `YYYY-MM-DD` string. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Interpret a date coming from a spreadsheet cell.
 * Ambiguous `a/b/c` values are read as DD/MM/YYYY.
 */
export function normaliseDateCell(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (isValidIsoDate(text)) return text;

  const slash = /^(\d{1,4})[/.](\d{1,2})[/.](\d{1,4})$/.exec(text);
  if (slash) {
    const [, first, second, third] = slash;
    let day = Number(first);
    let month = Number(second);
    let year = Number(third);
    if (year < 100) year += 2000;
    if (day > 12 && month <= 12) {
      // unambiguous DD/MM
    } else if (second.length === 2 && day <= 12 && month > 12) {
      const swap = day;
      day = month;
      month = swap;
    }
    const candidate = `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
    return isValidIsoDate(candidate) ? candidate : null;
  }
  return null;
}

/** Convert a raw cell into a typed value. */
export function coerceValue(raw: unknown, type: ColumnType): FieldValue {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return toIsoDate(raw);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'boolean') return raw;

  const text = String(raw).trim();
  if (!text) return null;

  if (type === 'number' || type === 'currency') {
    const cleaned = text.replace(/[\s,]/g, '').replace(/[^0-9.\-]/g, '');
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) && cleaned !== '' && cleaned !== '-' ? numeric : text;
  }
  if (type === 'date') {
    return normaliseDateCell(text) ?? text;
  }
  return text;
}

/** Build the value map of one spreadsheet row. */
export function extractRowValues(
  row: unknown[],
  headers: string[],
  mapping: ImportMapping,
  columns: FieldColumn[],
): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  columns.forEach((column) => {
    const index = mapping[column.key];
    if (index === undefined || index < 0) return;
    const raw = row[index];
    values[column.key] = coerceValue(raw, column.type);
  });
  void headers;
  return values;
}

/** Options for the plan builder. */
export interface BuildPlanOptions {
  mapping: ImportMapping;
  headers: string[];
  rows: unknown[][];
  rowNumbers: number[];
  /** Record IDs that already exist in the database. */
  existingRecordIds: Set<string>;
  customFields: FieldDefinition[];
  strategy: ImportStrategy;
}

/** Build a reviewable import plan from the parsed spreadsheet. */
export function buildImportPlan(options: BuildPlanOptions): ImportPlan {
  const { mapping, headers, rows, rowNumbers, existingRecordIds, customFields, strategy } = options;
  const columns = getAllColumns(customFields);
  const schema = buildRecordSchema(customFields);

  const rejected: RejectedRow[] = [];
  const parsed: ParsedImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = rowNumbers[index] ?? index + 2;
    const values = extractRowValues(row, headers, mapping, columns);

    const raw: Record<string, unknown> = {};
    headers.forEach((header, headerIndex) => {
      raw[header] = row[headerIndex] ?? null;
    });

    const custom: Record<string, FieldValue> = {};
    columns.forEach((column) => {
      if (!isCustomColumn(column.key)) return;
      const fieldKey = customFieldKeyFromColumn(column.key);
      const value = values[column.key];
      if (value === null || value === undefined || value === '') {
        custom[fieldKey] = null;
        return;
      }
      custom[fieldKey] =
        fieldKey === 'marital_status' && typeof value === 'string' && value.trim().toLowerCase() === 'single'
          ? 'Unmarried'
          : column.type === 'number'
            ? (typeof value === 'number' ? value : Number(value))
            : value;
    });

    const candidate = {
      recordId: String(values.recordId ?? '').trim(),
      date: typeof values.date === 'string' ? values.date.trim() : '',
      title: typeof values.title === 'string' ? values.title.trim() : '',
      category: typeof values.category === 'string' ? values.category.trim() : '',
      description: typeof values.description === 'string' ? values.description.trim() : '',
      quantity: (values.quantity as number | null) ?? null,
      unitPrice: (values.unitPrice as number | null) ?? null,
      custom,
    };

    const result = schema.safeParse(candidate);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => {
        const field = issue.path[0] === 'custom' ? String(issue.path[1] ?? '') : String(issue.path[0] ?? '');
        return field ? `${field}: ${issue.message}` : issue.message;
      });
      rejected.push({ rowNumber, reason: messages.join('; '), raw });
      return;
    }

    parsed.push({
      rowNumber,
      recordId: result.data.recordId,
      input: {
        recordId: result.data.recordId,
        date: result.data.date,
        title: result.data.title,
        category: result.data.category,
        description: result.data.description ?? '',
        quantity: result.data.quantity,
        unitPrice: result.data.unitPrice,
        custom: result.data.custom ?? {},
      },
      values,
    });
  });

  // Duplicates inside the same file: keep the last occurrence.
  const duplicates: RejectedRow[] = [];
  const lastIndexById = new Map<string, number>();
  parsed.forEach((row, index) => lastIndexById.set(row.recordId, index));
  const uniqueRows: ParsedImportRow[] = [];
  parsed.forEach((row, index) => {
    if (lastIndexById.get(row.recordId) !== index) {
      duplicates.push({
        rowNumber: row.rowNumber,
        reason: `Duplicate Employee ID "${row.recordId}" inside the file — the last occurrence is used.`,
        raw: { 'Employee ID': row.recordId, 'Employee Name': row.input.title },
      });
      return;
    }
    uniqueRows.push(row);
  });

  const inserts: ParsedImportRow[] = [];
  const updates: ParsedImportRow[] = [];
  const skipped: RejectedRow[] = [];

  uniqueRows.forEach((row) => {
    const exists = existingRecordIds.has(row.recordId);
    if (strategy === 'insert-only') {
      if (exists) {
        skipped.push({
          rowNumber: row.rowNumber,
          reason: `Employee ID "${row.recordId}" already exists — skipped (add-new-only strategy).`,
          raw: { 'Employee ID': row.recordId, 'Employee Name': row.input.title },
        });
      } else {
        inserts.push(row);
      }
      return;
    }
    if (strategy === 'update-only') {
      if (exists) {
        updates.push(row);
      } else {
        skipped.push({
          rowNumber: row.rowNumber,
          reason: `No existing employee with ID "${row.recordId}" — skipped (update-only strategy).`,
          raw: { 'Employee ID': row.recordId, 'Employee Name': row.input.title },
        });
      }
      return;
    }
    if (exists) updates.push(row);
    else inserts.push(row);
  });

  return {
    total: rows.length,
    valid: uniqueRows.length,
    rejected,
    duplicates,
    inserts,
    updates,
    skipped,
  };
}
