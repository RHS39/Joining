/**
 * Reading the text of an image with OCR (Tesseract).
 *
 * The OCR engine and the English language data are served by the application
 * itself, so the reading also works without an internet connection. Nothing is
 * uploaded anywhere — the image is read in the browser.
 */
import { createOcrWorker, type OcrProgress } from './tesseract';

export type { OcrProgress } from './tesseract';

/**
 * Read the text of an image with OCR.
 *
 * The plain text of the image is returned — the caller decides what is read
 * out of it.
 */
export async function ocrImage(blob: Blob, onProgress?: (progress: OcrProgress) => void): Promise<string> {
  const worker = await createOcrWorker(onProgress);

  try {
    const result = await worker.recognize(blob);
    return result.data.text ?? '';
  } finally {
    await worker.terminate();
  }
}
