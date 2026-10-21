/**
 * Browser download helpers.
 */

/** Trigger a download for a Blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Give the browser a tick to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Trigger a download for plain text content. */
export function downloadText(content: string, fileName: string, mimeType = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([content], { type: mimeType }), fileName);
}
