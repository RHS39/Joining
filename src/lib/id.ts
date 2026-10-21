/**
 * Identifier helpers.
 */

/** Create a UUID v4 (falls back to a random string on very old browsers). */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Prefix of the employee identifier. */
const EMPLOYEE_ID_PREFIX = 'EMP-';

/** Number of digits of the employee number. */
const EMPLOYEE_ID_DIGITS = 4;

/**
 * The number of an employee identifier: `EMP-0138` is the number 138.
 *
 * `null` when the identifier does not carry a number — an id of an older
 * version or an id that was typed by hand.
 */
export function employeeNumberFromId(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^EMP-(\d+)$/i.exec(value.trim());
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

/** The identifier of an employee number: `138` is `EMP-0138`. */
export function formatEmployeeId(number: number): string {
  const value = Math.max(0, Math.trunc(number));
  return `${EMPLOYEE_ID_PREFIX}${`${value}`.padStart(EMPLOYEE_ID_DIGITS, '0')}`;
}

/** Current time as an ISO timestamp. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date as `YYYY-MM-DD`. */
export function todayIsoDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
