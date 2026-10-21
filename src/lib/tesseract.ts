/**
 * Starting the OCR engine.
 *
 * The worker, the WebAssembly core and the English language data are served
 * by the application itself, so that the OCR also works on a network that
 * cannot reach a CDN. The files are put into the public folder by
 * `scripts/prepare-tesseract.mjs`, which runs before the build and before
 * the development server.
 */

/** The folder the engine is in. */
const folder = `${import.meta.env.BASE_URL}tesseract`;

/** The path of the worker. */
export const TESSERACT_WORKER_PATH = `${folder}/worker.min.js`;

/** The path of the folder with the WebAssembly core. */
export const TESSERACT_CORE_PATH = `${folder}/core`;

/** The path of the folder with the language data. */
export const TESSERACT_LANG_PATH = `${folder}/lang`;

/** Progress of the OCR run. */
export interface OcrProgress {
  /** What the engine is doing at the moment. */
  status: string;
  /** How much of the work is done, 0 to 1. */
  progress: number;
}

/**
 * Start the OCR engine.
 *
 * The engine of the application is used first. When the files are not in the
 * public folder — the prepare script was not run — the engine is loaded from
 * a CDN instead, which needs an internet connection.
 */
export async function createOcrWorker(onProgress?: (progress: OcrProgress) => void) {
  const { createWorker } = await import('tesseract.js');

  const logger = (message: { status: string; progress: number }) => {
    if (!onProgress) return;
    onProgress({ status: message.status, progress: message.progress ?? 0 });
  };

  try {
    return await createWorker('eng', 1, {
      workerPath: TESSERACT_WORKER_PATH,
      corePath: TESSERACT_CORE_PATH,
      langPath: TESSERACT_LANG_PATH,
      logger,
    });
  } catch {
    // The engine is not in the public folder — the CDN is the second choice.
    return createWorker('eng', 1, { logger });
  }
}
