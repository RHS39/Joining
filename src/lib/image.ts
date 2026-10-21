/**
 * Client side image handling: validation, resizing to the photo frame and compression.
 *
 * A picked photo is scaled and cropped so that it fills the photo frame
 * (350 x 450 pixels) exactly, and is then compressed before it is stored.
 *
 * Images are kept as Blobs the whole way — they are never converted to base64
 * strings, except when a full backup archive is produced.
 */
import imageCompression from 'browser-image-compression';

/** Mime types accepted by the application. */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** File extensions shown in the accept attribute. */
export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Maximum size of a file the user may pick (before compression). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Width of the photo frame, in pixels (7:9 portrait). */
export const PHOTO_FRAME_WIDTH = 350;

/** Height of the photo frame, in pixels (7:9 portrait). */
export const PHOTO_FRAME_HEIGHT = 450;

/** Maximum size of a stored image, in megabytes. */
export const MAX_IMAGE_SIZE_MB = 1;

/** Encoder quality used for the stored image. */
const DEFAULT_QUALITY = 0.9;

/** Lowest quality that is still used before the size limit is given up. */
const MIN_QUALITY = 0.5;

/** How the picked image is mapped into the photo frame. */
export type ImageFit =
  /** The frame is filled completely, the overflow is cropped in the middle. */
  | 'cover'
  /** The whole image stays visible, the rest of the frame is left empty. */
  | 'contain';

export interface ProcessImageOptions {
  /** Width of the target frame, in pixels. Defaults to `PHOTO_FRAME_WIDTH`. */
  targetWidth?: number;
  /** Height of the target frame, in pixels. Defaults to `PHOTO_FRAME_HEIGHT`. */
  targetHeight?: number;
  /** How the image is mapped into the frame. Defaults to `cover`. */
  fit?: ImageFit;
  /** Maximum size of the stored image, in megabytes. */
  maxSizeMB?: number;
  /** Encoder quality between 0 and 1. */
  quality?: number;
}

export interface ProcessedImage {
  blob: Blob;
  mimeType: string;
  fileName: string;
  size: number;
  width: number;
  height: number;
  originalSize: number;
  originalWidth: number | null;
  originalHeight: number | null;
}

/** Thrown for user-fixable problems (wrong type, too large, corrupt file). */
export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

/** True when the file mime type is supported. */
export function isSupportedImageType(type: string): boolean {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type.toLowerCase());
}

/** Validate a picked file before doing any expensive work. */
export function validateImageFile(file: File): void {
  if (!isSupportedImageType(file.type)) {
    throw new ImageProcessingError(
      `Unsupported image format "${file.type || 'unknown'}". Allowed formats: JPEG, PNG and WebP.`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageProcessingError(
      `The photo is ${(file.size / 1024 / 1024).toFixed(1)} MB which exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB upload limit.`,
    );
  }
  if (file.size === 0) {
    throw new ImageProcessingError('The selected file is empty.');
  }
}

/** The image element a blob was decoded into. */
type Drawable = ImageBitmap | HTMLImageElement;

async function loadDrawable(source: Blob): Promise<Drawable | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies the EXIF rotation of the photo, so a portrait
      // picture taken with a phone is not stored sideways.
      return await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to the <img> based fallback */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function closeDrawable(drawable: Drawable): void {
  if ('close' in drawable && typeof drawable.close === 'function') {
    drawable.close();
  }
}

/** Read the pixel dimensions of a blob. */
async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const drawable = await loadDrawable(blob);
  if (!drawable) return { width: 0, height: 0 };
  const width = 'naturalWidth' in drawable ? drawable.naturalWidth : drawable.width;
  const height = 'naturalHeight' in drawable ? drawable.naturalHeight : drawable.height;
  closeDrawable(drawable);
  return { width, height };
}

/**
 * Shrink and compress the picked file.
 *
 * The source is reduced to twice the size of the frame, which is enough to cut
 * a sharp frame out of it and keeps the memory usage of the browser low.
 */
async function shrinkSource(
  file: File,
  targetWidth: number,
  targetHeight: number,
  maxSizeMB: number,
  quality: number,
): Promise<Blob> {
  try {
    return await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight: Math.max(targetWidth, targetHeight) * 2,
      useWebWorker: true,
      initialQuality: quality,
      fileType: file.type,
      preserveExif: false,
    });
  } catch {
    // The compressor is only a helper — the frame is cut from the original
    // file when it fails.
    return file;
  }
}

/**
 * Cut the frame out of the source image.
 *
 * `cover` scales the source so that it fills the whole frame and crops the
 * overflow in the middle, `contain` scales it down until the whole image fits.
 */
async function renderFrame(
  source: Blob,
  targetWidth: number,
  targetHeight: number,
  fit: ImageFit,
  maxSizeMB: number,
  quality: number,
): Promise<Blob> {
  const drawable = await loadDrawable(source);
  if (!drawable) {
    throw new ImageProcessingError('The photo could not be read. Try a different file.');
  }

  const sourceWidth = 'naturalWidth' in drawable ? drawable.naturalWidth : drawable.width;
  const sourceHeight = 'naturalHeight' in drawable ? drawable.naturalHeight : drawable.height;
  if (!sourceWidth || !sourceHeight) {
    closeDrawable(drawable);
    throw new ImageProcessingError('The photo could not be read. Try a different file.');
  }

  const scale =
    fit === 'cover'
      ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
      : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    closeDrawable(drawable);
    throw new ImageProcessingError('The photo could not be processed. Try a different file.');
  }

  // A white background keeps a transparent photo from turning black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(drawable, offsetX, offsetY, drawWidth, drawHeight);
  closeDrawable(drawable);

  return encodeFrame(canvas, maxSizeMB, quality);
}

/** Encode the frame as JPEG, lowering the quality until the size limit is met. */
async function encodeFrame(canvas: HTMLCanvasElement, maxSizeMB: number, quality: number): Promise<Blob> {
  const limit = maxSizeMB * 1024 * 1024;
  let currentQuality = quality;
  let blob = await canvasToBlob(canvas, currentQuality);

  while (blob.size > limit && currentQuality > MIN_QUALITY) {
    currentQuality = Math.max(MIN_QUALITY, currentQuality - 0.1);
    const smaller = await canvasToBlob(canvas, currentQuality);
    // Stop when the quality no longer buys a smaller file.
    if (smaller.size >= blob.size) break;
    blob = smaller;
  }

  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new ImageProcessingError('The photo could not be encoded. Try a different file.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Keep the file name in sync with the format the image is stored in. */
export function fileNameForMimeType(fileName: string, mimeType: string): string {
  const extension = MIME_EXTENSIONS[mimeType.toLowerCase()];
  if (!extension) return fileName;
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return `${base || 'photo'}${extension}`;
}

/**
 * Resize and compress an image so that it fits into the photo frame
 * (`targetWidth` x `targetHeight`) and stays below `maxSizeMB`.
 */
export async function processImageFile(file: File, options: ProcessImageOptions = {}): Promise<ProcessedImage> {
  validateImageFile(file);

  const targetWidth = Math.max(1, Math.round(options.targetWidth ?? PHOTO_FRAME_WIDTH));
  const targetHeight = Math.max(1, Math.round(options.targetHeight ?? PHOTO_FRAME_HEIGHT));
  const fit = options.fit ?? 'cover';
  const maxSizeMB = options.maxSizeMB ?? MAX_IMAGE_SIZE_MB;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const originalDimensions = await readDimensions(file);

  const source = await shrinkSource(file, targetWidth, targetHeight, maxSizeMB, quality);
  const blob = await renderFrame(source, targetWidth, targetHeight, fit, maxSizeMB, quality);

  const dimensions = await readDimensions(blob);
  const mimeType = blob.type || 'image/jpeg';

  return {
    blob,
    mimeType,
    fileName: fileNameForMimeType(file.name, mimeType),
    size: blob.size,
    width: dimensions.width || targetWidth,
    height: dimensions.height || targetHeight,
    originalSize: file.size,
    originalWidth: originalDimensions.width || null,
    originalHeight: originalDimensions.height || null,
  };
}

/** Longest side of an image that is read with OCR, in pixels. */
export const OCR_MAX_SIDE = 1800;

/**
 * Shrink a picked image for the OCR.
 *
 * The whole page stays visible — only the size is reduced, so the text of a
 * passbook stays sharp enough to be read.
 */
export async function prepareImageForOcr(file: File, maxSide = OCR_MAX_SIDE): Promise<Blob> {
  validateImageFile(file);

  const drawable = await loadDrawable(file);
  if (!drawable) {
    throw new ImageProcessingError('The photo could not be read. Try a different file.');
  }

  const sourceWidth = 'naturalWidth' in drawable ? drawable.naturalWidth : drawable.width;
  const sourceHeight = 'naturalHeight' in drawable ? drawable.naturalHeight : drawable.height;
  if (!sourceWidth || !sourceHeight) {
    closeDrawable(drawable);
    throw new ImageProcessingError('The photo could not be read. Try a different file.');
  }

  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    closeDrawable(drawable);
    throw new ImageProcessingError('The photo could not be processed. Try a different file.');
  }

  // A white background keeps a transparent photo from turning black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  closeDrawable(drawable);

  return canvasToBlob(canvas, 0.92);
}

/** Convert a Blob into a data URL (used only for the backup archive). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/** Convert a data URL back into a Blob (used only when restoring a backup). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/** Create an object URL for a blob. The caller owns the lifetime of the URL. */
export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
