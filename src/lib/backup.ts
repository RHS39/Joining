/**
 * Full application backup: records + settings + image attachments.
 *
 * The archive is a single JSON file so it can be stored anywhere. Images are
 * base64 encoded inside the archive — this is the only place where a Blob is
 * turned into a string, and it never happens for the live database.
 */
import { db } from '@/db/db';
import { getAllImages, getSettings } from '@/db/repository';
import type { DataRecord, FieldDefinition, ImageAttachment, SettingsBundle } from '@/types';
import { blobToDataUrl, dataUrlToBlob } from './image';
import { downloadText } from './download';
import { safeFileName } from './format';

export const BACKUP_FORMAT = 'kores-employee-records-backup';
export const BACKUP_VERSION = 1;

export interface BackupImage {
  /** Record ID (business identifier) the image belongs to. */
  recordId: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  data: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appTitle: string;
  records: DataRecord[];
  images: BackupImage[];
  settings: {
    categories: string[];
    customFields: FieldDefinition[];
    preferences: SettingsBundle['preferences'];
  };
}

/** Build the backup archive in memory. */
export async function createBackup(): Promise<BackupFile> {
  const settings = await getSettings();
  const records = await db.records.toArray();
  const images = await getAllImages();

  const recordIdByKey = new Map(records.map((record) => [record.id, record.recordId]));

  const backupImages: BackupImage[] = [];
  for (const image of images) {
    backupImages.push({
      recordId: recordIdByKey.get(image.recordKey) ?? '',
      fileName: image.fileName,
      mimeType: image.mimeType,
      size: image.size,
      width: image.width,
      height: image.height,
      data: await blobToDataUrl(image.blob),
    });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appTitle: settings.preferences.appTitle,
    records,
    images: backupImages,
    settings: {
      categories: settings.categories,
      customFields: settings.customFields,
      preferences: settings.preferences,
    },
  };
}

/** Download the backup archive. */
export function downloadBackup(backup: BackupFile): void {
  const stamp = backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  downloadText(
    JSON.stringify(backup, null, 2),
    `${safeFileName(backup.appTitle || 'kores-employee-records')}-backup-${stamp}.json`,
    'application/json;charset=utf-8',
  );
}

/** Parse and validate a backup file. */
export async function parseBackupFile(file: File): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  const backup = parsed as Partial<BackupFile>;
  if (!backup || backup.format !== BACKUP_FORMAT) {
    throw new Error('This file is not an employee register backup archive.');
  }
  if (!Array.isArray(backup.records)) {
    throw new Error('The backup archive does not contain an employee list.');
  }
  if (!backup.settings || !Array.isArray(backup.settings.categories)) {
    throw new Error('The backup archive does not contain settings.');
  }

  return {
    format: BACKUP_FORMAT,
    version: typeof backup.version === 'number' ? backup.version : 1,
    exportedAt: backup.exportedAt ?? new Date().toISOString(),
    appTitle: backup.appTitle ?? 'Kores Employee Records',
    records: backup.records,
    images: Array.isArray(backup.images) ? backup.images : [],
    settings: {
      categories: backup.settings.categories,
      customFields: Array.isArray(backup.settings.customFields) ? backup.settings.customFields : [],
      preferences: backup.settings.preferences,
    },
  };
}

/** Restore a backup, replacing the current content of the database. */
export async function restoreBackup(backup: BackupFile): Promise<{ records: number; images: number }> {
  const imagesByRecordId = new Map<string, BackupImage>();
  backup.images.forEach((image) => {
    if (image.recordId) imagesByRecordId.set(image.recordId, image);
  });

  return db.transaction('rw', db.records, db.images, db.settings, async () => {
    await db.records.clear();
    await db.images.clear();
    await db.settings.clear();

    let imageCount = 0;
    for (const record of backup.records) {
      const image = imagesByRecordId.get(record.recordId);
      let hasImage = false;
      if (image) {
        const blob = await dataUrlToBlob(image.data);
        const attachment: ImageAttachment = {
          recordKey: record.id,
          blob,
          mimeType: image.mimeType || blob.type,
          fileName: image.fileName,
          size: image.size || blob.size,
          width: image.width,
          height: image.height,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
        await db.images.put(attachment);
        hasImage = true;
        imageCount += 1;
      }
      await db.records.put({ ...record, hasImage });
    }

    const now = new Date().toISOString();
    await db.settings.bulkPut([
      { key: 'categories', value: backup.settings.categories, updatedAt: now },
      { key: 'customFields', value: backup.settings.customFields, updatedAt: now },
      { key: 'preferences', value: backup.settings.preferences, updatedAt: now },
    ]);

    return { records: backup.records.length, images: imageCount };
  });
}
