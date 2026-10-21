/**
 * Small helpers to turn unknown exceptions into human friendly messages.
 */

const QUOTA_HINTS = [
  'quota',
  'exceeded',
  'no space',
  'storage',
  'NS_ERROR_DOM_QUOTA_REACHED',
];

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  }
  const name = (error as { name?: string })?.name ?? '';
  const message = (error as { message?: string })?.message ?? '';
  if (name === 'QuotaExceededError') return true;
  return QUOTA_HINTS.some((hint) => message.toLowerCase().includes(hint.toLowerCase()));
}

/** Convert any thrown value into a readable message. */
export function describeError(error: unknown, fallback = 'Something went wrong.'): string {
  if (isQuotaError(error)) {
    return 'The browser storage quota was reached. Free up space (remove large photos, export a backup) and try again — no data was lost.';
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}
