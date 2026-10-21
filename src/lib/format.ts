/**
 * Formatting helpers shared by the UI, the reports and the spreadsheet export.
 */
import type { PageSize } from '@/types';

/**
 * The dates are written the way the Indian joining forms write them: the day
 * comes first. The locale is fixed, so the format does not change with the
 * language of the browser.
 */
const DATE_LOCALE = 'en-GB';

const DATE_FORMAT = new Intl.DateTimeFormat(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
const DATETIME_FORMAT = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Parse an ISO date string safely. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2024-05-04` -> `04 May 2024`. */
export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? DATE_FORMAT.format(date) : '—';
}

/** ISO timestamp -> `04 May 2024, 10:32`. */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? DATETIME_FORMAT.format(date) : '—';
}

/** Format a number with the given number of decimals. */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format a monetary amount using the configured ISO currency code. */
export function formatCurrency(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: decimals }).format(value);
  } catch {
    return `${currency} ${formatNumber(value, decimals)}`;
  }
}

/** Human readable byte size. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Page size in millimetres (used for the on-screen print preview). */
export function pageSizeInMm(size: PageSize): { width: number; height: number } {
  return size === 'A4' ? { width: 210, height: 297 } : { width: 215.9, height: 279.4 };
}

/** Build a file name safe for downloads. */
export function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'export';
}
