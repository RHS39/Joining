/**
 * The counter of the cloud reads.
 *
 * A photo is read in the browser for free. The cloud reader is only used when
 * the free read is not good enough, so that the small quota of cloud reads
 * lasts. The counter is kept in the local database, so it counts per device
 * and per browser profile.
 */
import { db } from '@/db/db';

/** Cloud reads that are allowed per day. */
export const OCR_QUOTA_PER_DAY = 10;

/** Cloud reads that are allowed per month. */
export const OCR_QUOTA_PER_MONTH = 25;

/** The key of the counter in the settings table. */
const QUOTA_KEY = 'ocr_quota';

/**
 * The time zone the day and the month are counted in.
 *
 * The daily limit of the model resets at midnight Pacific time, so the counter
 * rolls over at the same moment.
 */
const QUOTA_TIME_ZONE = 'America/Los_Angeles';

/** The counter as it is stored. */
interface QuotaRecord {
  /** The day the counts belong to, as YYYY-MM-DD. */
  day: string;
  /** The number of cloud reads of that day. */
  dayCount: number;
  /** The month the counts belong to, as YYYY-MM. */
  month: string;
  /** The number of cloud reads of that month. */
  monthCount: number;
}

/** What the user is allowed to do. */
export interface OcrQuota {
  /** The number of cloud reads of today. */
  dayCount: number;
  /** The number of cloud reads that are allowed per day. */
  dayLimit: number;
  /** The number of cloud reads of this month. */
  monthCount: number;
  /** The number of cloud reads that are allowed per month. */
  monthLimit: number;
  /** The number of cloud reads that are left today. */
  dayRemaining: number;
  /** The number of cloud reads that are left this month. */
  monthRemaining: number;
  /** True when another cloud read is allowed. */
  canUse: boolean;
}

/** The day and the month of a moment, in the time zone of the counter. */
function dateParts(now: Date): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: QUOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = value('year');
  const month = value('month');
  const day = value('day');
  return { day: `${year}-${month}-${day}`, month: `${year}-${month}` };
}

/** The counter as it is stored, with empty counts. */
async function readRecord(): Promise<QuotaRecord> {
  const row = await db.settings.get(QUOTA_KEY);
  const value = row?.value as Partial<QuotaRecord> | undefined;
  return {
    day: typeof value?.day === 'string' ? value.day : '',
    dayCount: typeof value?.dayCount === 'number' ? value.dayCount : 0,
    month: typeof value?.month === 'string' ? value.month : '',
    monthCount: typeof value?.monthCount === 'number' ? value.monthCount : 0,
  };
}

/** The state of the counter. */
function state(dayCount: number, monthCount: number): OcrQuota {
  const dayRemaining = Math.max(0, OCR_QUOTA_PER_DAY - dayCount);
  const monthRemaining = Math.max(0, OCR_QUOTA_PER_MONTH - monthCount);
  return {
    dayCount,
    dayLimit: OCR_QUOTA_PER_DAY,
    monthCount,
    monthLimit: OCR_QUOTA_PER_MONTH,
    dayRemaining,
    monthRemaining,
    canUse: dayRemaining > 0 && monthRemaining > 0,
  };
}

/**
 * The cloud reads that are left.
 *
 * The counts of a day that is over and of a month that is over are dropped.
 */
export async function readOcrQuota(): Promise<OcrQuota> {
  const record = await readRecord();
  const { day, month } = dateParts(new Date());
  const dayCount = record.day === day ? record.dayCount : 0;
  const monthCount = record.month === month ? record.monthCount : 0;
  return state(dayCount, monthCount);
}

/**
 * Use one cloud read.
 *
 * The counter is only raised when a read is still allowed — the caller has to
 * check {@link readOcrQuota} first.
 */
export async function useOcrQuota(): Promise<OcrQuota> {
  const { day, month } = dateParts(new Date());
  const record = await readRecord();
  const dayCount = (record.day === day ? record.dayCount : 0) + 1;
  const monthCount = (record.month === month ? record.monthCount : 0) + 1;

  await db.settings.put({
    key: QUOTA_KEY,
    value: { day, dayCount, month, monthCount } satisfies QuotaRecord,
    updatedAt: new Date().toISOString(),
  });

  return state(dayCount, monthCount);
}
