import Dexie, { type EntityTable } from 'dexie';
import type { DataRecord, ImageAttachment, SettingRow } from '@/types';

/**
 * IndexedDB powered local database.
 *
 * - `records`  : the structured dataset.
 * - `images`   : compressed image blobs linked to a record through `recordKey`.
 * - `settings` : key/value store for categories, custom fields and preferences.
 */
export const db = new Dexie('kores-records') as Dexie & {
  records: EntityTable<DataRecord, 'id'>;
  images: EntityTable<ImageAttachment, 'recordKey'>;
  settings: EntityTable<SettingRow, 'key'>;
};

db.version(1).stores({
  records: 'id, recordId, date, title, category, createdAt, updatedAt, [category+date]',
  images: 'recordKey',
  settings: 'key',
});

export const DB_NAME = 'kores-records';
