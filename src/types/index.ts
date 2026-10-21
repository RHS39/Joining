/**
 * Core domain types for the Kores Records application.
 *
 * The model is intentionally "record + free-form custom fields" so new data can be
 * captured later without rewriting the database, forms, tables, importers or reports.
 */

/** A value that can be stored in a user-defined field. */
export type FieldValue = string | number | boolean | null;

/** Supported types for user-defined (custom) fields. */
export type CustomFieldType = 'text' | 'multiline' | 'number' | 'date' | 'select';

/** Definition of a user-defined field stored in settings. */
export interface FieldDefinition {
  /** Machine key, unique inside the application (e.g. `vendor`). */
  key: string;
  /** Human readable label (e.g. `Vendor`). */
  label: string;
  /** Data type of the field. */
  type: CustomFieldType;
  /** Allowed values when `type === 'select'`. */
  options?: string[];
  /** Whether the field must be filled in. */
  required?: boolean;
  /** Optional section heading used to group the fields in the form. */
  section?: string;
  /** Value pre-filled when a new record is created. */
  defaultValue?: string;
  /**
   * Alternative names of the field. They are used to match a spreadsheet
   * header and a label printed on a PDF form.
   */
  aliases?: string[];
}

/** A single record of the dataset. */
export interface DataRecord {
  /** Internal primary key (UUID). Never shown in exports. */
  id: string;
  /** Human readable, unique business identifier (e.g. `REC-8F3A91C0D2`). */
  recordId: string;
  /** ISO date string `YYYY-MM-DD`. */
  date: string;
  /** Title / name of the record. */
  title: string;
  /** Category of the record. */
  category: string;
  /** Free form description. */
  description: string;
  /** Quantity, `null` when not applicable. */
  quantity: number | null;
  /** Unit price, `null` when not applicable. */
  unitPrice: number | null;
  /** Quantity x unit price, `null` when either side is missing. */
  totalAmount: number | null;
  /** True when an image is attached to this record. */
  hasImage: boolean;
  /** Values of user-defined fields, keyed by `FieldDefinition.key`. */
  custom: Record<string, FieldValue>;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last update. */
  updatedAt: string;
}

/** An image attached to a record, stored as a compressed Blob. */
export interface ImageAttachment {
  /** Foreign key pointing at `DataRecord.id`. */
  recordKey: string;
  /** Compressed binary payload. */
  blob: Blob;
  /** Mime type of the stored blob. */
  mimeType: string;
  /** Original file name. */
  fileName: string;
  /** Size of the stored blob in bytes. */
  size: number;
  /** Pixel width of the stored image. */
  width: number;
  /** Pixel height of the stored image. */
  height: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the last update. */
  updatedAt: string;
}

/** A key/value row of the settings table. */
export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

/** Paper sizes supported by the report generator. */
export type PageSize = 'A4' | 'Letter';

/** Page orientations supported by the report generator. */
export type Orientation = 'portrait' | 'landscape';

/** Report layouts available in the report generator. */
export type ReportLayout = 'summary' | 'card' | 'grid';

/** Application level preferences (titles, currency, print defaults...). */
export interface AppPreferences {
  appTitle: string;
  organisation: string;
  currency: string;
  footerNote: string;
  defaultPageSize: PageSize;
  defaultOrientation: Orientation;
  showImagesInReports: boolean;
  /** Show the quantity / unit price / total amount block in the data entry form. */
  showQuantities: boolean;
  /** Category that is pre-selected for a new employee. */
  defaultCategory: string;
}

/** Values that can be written to / read from the settings table. */
export interface SettingsBundle {
  categories: string[];
  customFields: FieldDefinition[];
  preferences: AppPreferences;
}

/** The payload accepted by the repository when creating/updating a record. */
export interface RecordInput {
  recordId: string;
  date: string;
  title: string;
  category: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  custom: Record<string, FieldValue>;
}

/** Sort keys offered by the records table. */
export type SortKey = 'date' | 'title' | 'category' | 'recordId' | 'quantity' | 'unitPrice' | 'totalAmount' | 'createdAt';

/** Filter state shared by the records table and the report generator. */
export interface RecordFilters {
  /** Free text search across record id, title and description. */
  search: string;
  /** Category filter, `''` means every category. */
  category: string;
  /** Inclusive lower bound (ISO date) or `''`. */
  dateFrom: string;
  /** Inclusive upper bound (ISO date) or `''`. */
  dateTo: string;
}

/** Default filter state. */
export const EMPTY_FILTERS: RecordFilters = {
  search: '',
  category: '',
  dateFrom: '',
  dateTo: '',
};
