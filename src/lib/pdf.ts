/**
 * PDF reading for the "auto-fill from PDF" helper.
 *
 * Two kinds of documents are supported:
 *  - a PDF with a text layer (a form that was filled on a computer),
 *  - a scanned PDF, which is read with OCR (Tesseract).
 *
 * Both libraries are loaded on demand: they are only downloaded when a user
 * actually uploads a PDF, the rest of the application never pays for them.
 * The OCR engine itself is part of the application, so it also works without
 * an internet connection.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createOcrWorker, type OcrProgress } from './tesseract';

/** A piece of text with its position on the page (PDF points). */
export interface PdfWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The text of one page. */
export interface PdfPage {
  pageNumber: number;
  /** Width of the page in PDF points. */
  width: number;
  /** Height of the page in PDF points. */
  height: number;
  words: PdfWord[];
}

/** A rendered page, used by the OCR fallback. */
export interface PdfPageImage {
  canvas: HTMLCanvasElement;
  /** Width of the page in PDF points. */
  width: number;
  /** Height of the page in PDF points. */
  height: number;
  /** Factor between the canvas pixels and the PDF points. */
  scale: number;
}

/** An opened PDF document. */
export interface PdfSession {
  fileName: string;
  pageCount: number;
  /** Read the text layer of every page. */
  read(): Promise<PdfPage[]>;
  /** Render a page to a canvas (used by the OCR fallback). */
  renderPage(pageNumber: number, scale?: number): Promise<PdfPageImage>;
  /** Release the document. */
  close(): Promise<void>;
}

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/** Load PDF.js and its worker — only once per session of the application. */
async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/** Turn a PDF.js error into a message the user can act on. */
function describePdfError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') {
    return 'The PDF is protected by a password. Remove the password and upload the file again.';
  }
  if (name === 'InvalidPDFException' || name === 'MissingPDFException') {
    return 'The file could not be read as a PDF.';
  }
  return error instanceof Error ? error.message : 'The PDF could not be read.';
}

/** Open a PDF file and return a session that can read and render it. */
export async function openPdf(file: File): Promise<PdfSession> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });

  let pdfDocument: PDFDocumentProxy;
  try {
    pdfDocument = await task.promise;
  } catch (error) {
    throw new Error(describePdfError(error));
  }

  const read = async (): Promise<PdfPage[]> => {
    const pages: PdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const words: PdfWord[] = [];

      content.items.forEach((item) => {
        if (!('str' in item)) return;
        const text = item.str;
        if (!text.trim()) return;
        words.push({
          text,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height || 10,
        });
      });

      pages.push({ pageNumber, width: viewport.width, height: viewport.height, words });
    }
    return pages;
  };

  const renderPage = async (pageNumber: number, scale = 2): Promise<PdfPageImage> => {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not create a canvas for the PDF page.');
    await page.render({ canvas, viewport }).promise;
    return { canvas, width: viewport.width / scale, height: viewport.height / scale, scale };
  };

  const close = async (): Promise<void> => {
    await task.destroy();
  };

  return { fileName: file.name, pageCount: pdfDocument.numPages, read, renderPage, close };
}

/** Progress of the OCR run. */
export type { OcrProgress } from './tesseract';

/**
 * Read a scanned page with OCR (Tesseract).
 *
 * The OCR engine and the English language data are served by the application
 * itself, so this also works without an internet connection.
 */
export async function ocrPdfPage(
  session: PdfSession,
  pageNumber: number,
  onProgress?: (progress: OcrProgress) => void,
): Promise<PdfPage> {
  const image = await session.renderPage(pageNumber, 2);
  const worker = await createOcrWorker(onProgress);

  try {
    const result = await worker.recognize(image.canvas, {}, { blocks: true, text: true });
    const words: PdfWord[] = [];

    result.data.blocks?.forEach((block) => {
      block.paragraphs.forEach((paragraph) => {
        paragraph.lines.forEach((line) => {
          line.words.forEach((word) => {
            const text = word.text;
            if (!text.trim()) return;
            words.push({
              text,
              x: word.bbox.x0 / image.scale,
              y: image.height - word.bbox.y1 / image.scale,
              width: (word.bbox.x1 - word.bbox.x0) / image.scale,
              height: (word.bbox.y1 - word.bbox.y0) / image.scale,
            });
          });
        });
      });
    });

    return { pageNumber, width: image.width, height: image.height, words };
  } finally {
    await worker.terminate();
  }
}
