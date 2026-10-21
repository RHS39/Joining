/** Tiny class name helper (avoids an extra dependency). */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
