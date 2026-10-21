/**
 * Field/column catalogue.
 *
 * A single description of every importable & exportable field powers:
 *  - the Excel/CSV export column set,
 *  - the import column auto-mapping,
 *  - the records table columns,
 *  - the report layouts.
 *
 * Adding a new built-in field or a user-defined field therefore only requires
 * an entry here (plus, for user-defined fields, a definition in settings).
 */
import type { DataRecord, FieldDefinition, FieldValue } from '@/types';

/** Logical type of a column, used for parsing and rendering. */
export type ColumnType = 'text' | 'multiline' | 'date' | 'number' | 'currency' | 'category' | 'custom';

export interface FieldColumn {
  /** Stable key: built-in field name, or `custom:<fieldKey>`. */
  key: string;
  /** Column header shown in spreadsheets. */
  label: string;
  /** Parsing / rendering hint. */
  type: ColumnType;
  /** Alternative header names used by the import auto-mapper. */
  aliases: string[];
  /** Whether the column must be present in a spreadsheet row. */
  required?: boolean;
  /** Allowed values for `select` columns. */
  options?: string[];
}

const CUSTOM_PREFIX = 'custom:';

export const customColumnKey = (fieldKey: string): string => `${CUSTOM_PREFIX}${fieldKey}`;

export const isCustomColumn = (key: string): boolean => key.startsWith(CUSTOM_PREFIX);

export const customFieldKeyFromColumn = (key: string): string => key.slice(CUSTOM_PREFIX.length);

/** Built-in columns, in their canonical export order. */
export const BUILTIN_COLUMNS: FieldColumn[] = [
  {
    key: 'recordId',
    label: 'Employee ID',
    type: 'text',
    aliases: ['employee id', 'emp id', 'emp code', 'record id', 'id', 'ref', 'reference', 'code'],
    required: true,
  },
  {
    key: 'date',
    label: 'Date of Joining',
    type: 'date',
    aliases: [
      'date of joining',
      'joining date',
      'date of appointment',
      'appointment date',
      'date',
      'record date',
      'entry date',
    ],
    required: true,
  },
  {
    key: 'title',
    label: 'Employee Name',
    type: 'text',
    aliases: ['employee name', 'name of employee', 'full name', 'name', 'title'],
    required: true,
  },
  {
    key: 'category',
    label: 'Category',
    type: 'category',
    aliases: ['category', 'employee category', 'type', 'group', 'class'],
    required: true,
  },
  {
    key: 'description',
    label: 'Remarks',
    type: 'multiline',
    aliases: ['remarks', 'description', 'notes', 'details', 'comments'],
  },
  { key: 'quantity', label: 'Quantity', type: 'number', aliases: ['quantity', 'qty', 'count', 'units'] },
  { key: 'unitPrice', label: 'Unit Price', type: 'currency', aliases: ['unit price', 'price', 'rate', 'unit cost'] },
  { key: 'totalAmount', label: 'Total Amount', type: 'currency', aliases: ['total amount', 'total', 'amount', 'value'] },
];

/** Columns that only exist in the application, never in a spreadsheet. */
export const INTERNAL_COLUMNS: FieldColumn[] = [
  { key: 'createdAt', label: 'Created At', type: 'date', aliases: ['created at', 'created', 'created on'] },
  { key: 'updatedAt', label: 'Updated At', type: 'date', aliases: ['updated at', 'updated', 'modified'] },
];

/** Columns used for the Excel / CSV export. */
export const EXPORT_COLUMNS: FieldColumn[] = [...BUILTIN_COLUMNS];

/** Columns that can be mapped when importing a spreadsheet. */
export const IMPORTABLE_COLUMNS: FieldColumn[] = [...BUILTIN_COLUMNS.filter((c) => c.key !== 'totalAmount'), ...INTERNAL_COLUMNS];

/** Build the full column list, including user-defined fields. */
export function getAllColumns(customFields: FieldDefinition[]): FieldColumn[] {
  const custom: FieldColumn[] = customFields.map((field) => ({
    key: customColumnKey(field.key),
    label: field.label,
    type: field.type === 'select' ? 'category' : (field.type as ColumnType),
    aliases: [field.label, field.key, ...(field.aliases ?? [])],
    required: field.required,
    options: field.options,
  }));
  return [...BUILTIN_COLUMNS, ...custom];
}

/** Normalise a header for fuzzy matching. */
export function normaliseHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to guess which application column a spreadsheet header refers to.
 * Returns `undefined` when no confident match is found.
 */
export function guessColumnForHeader(
  header: string,
  columns: FieldColumn[],
  alreadyUsed: Set<string> = new Set(),
): string | undefined {
  const normalised = normaliseHeader(header);
  if (!normalised) return undefined;

  const candidates = columns.filter((column) => !alreadyUsed.has(column.key));

  const exact = candidates.find((column) => {
    const label = normaliseHeader(column.label);
    return label === normalised || normaliseHeader(column.key) === normalised;
  });
  if (exact) return exact.key;

  const alias = candidates.find((column) => column.aliases.some((a) => normaliseHeader(a) === normalised));
  if (alias) return alias.key;

  const partial = candidates.find((column) => {
    const label = normaliseHeader(column.label);
    return label.length >= 3 && (normalised.includes(label) || label.includes(normalised));
  });
  if (partial) return partial.key;

  return undefined;
}

/** Read a value out of a record for a given column. */
export function getColumnValue(record: DataRecord, columnKey: string): FieldValue {
  if (isCustomColumn(columnKey)) {
    return record.custom[customFieldKeyFromColumn(columnKey)] ?? null;
  }
  switch (columnKey) {
    case 'recordId':
      return record.recordId;
    case 'date':
      return record.date;
    case 'title':
      return record.title;
    case 'category':
      return record.category;
    case 'description':
      return record.description;
    case 'quantity':
      return record.quantity;
    case 'unitPrice':
      return record.unitPrice;
    case 'totalAmount':
      return record.totalAmount;
    case 'createdAt':
      return record.createdAt;
    case 'updatedAt':
      return record.updatedAt;
    default:
      return null;
  }
}

/** Write a value into a record for a given column. */
export function setColumnValue(target: Record<string, unknown>, columnKey: string, value: FieldValue): void {
  if (isCustomColumn(columnKey)) {
    const custom = (target.custom as Record<string, FieldValue>) ?? {};
    custom[customFieldKeyFromColumn(columnKey)] = value;
    target.custom = custom;
    return;
  }
  target[columnKey] = value;
}

/** Human readable label for a column key. */
export function getColumnLabel(columns: FieldColumn[], columnKey: string): string {
  return columns.find((column) => column.key === columnKey)?.label ?? columnKey;
}
