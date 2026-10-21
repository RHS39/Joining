import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useObjectUrl } from '@/hooks/useImages';
import { formatBytes } from '@/lib/format';
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  PHOTO_FRAME_HEIGHT,
  PHOTO_FRAME_WIDTH,
} from '@/lib/image';

export interface ImagePreview {
  blob: Blob;
  fileName: string;
  size: number;
  width: number;
  height: number;
  originalSize?: number;
  originalWidth?: number | null;
  originalHeight?: number | null;
}

interface ImageFieldProps {
  preview: ImagePreview | null;
  /** True when the record already has an image stored in the database. */
  hasExisting: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
  error?: string;
  busy?: boolean;
}

export function ImageField({ preview, hasExisting, onFile, onRemove, error, busy = false }: ImageFieldProps) {
  const url = useObjectUrl(preview?.blob ?? null);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-36 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-ink-100">
          {url ? (
            <img src={url} alt="Selected photo preview" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-10 w-10 text-ink-400" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-ink-800">Photo (optional)</p>
            <p className="mt-0.5 text-xs text-ink-500">
              JPEG, PNG or WebP, up to {formatBytes(MAX_UPLOAD_BYTES)}. The photo is resized to{' '}
              {PHOTO_FRAME_WIDTH} x {PHOTO_FRAME_HEIGHT} pixels — it is cropped to fill the frame — and compressed
              before it is stored.
            </p>
          </div>

          {preview ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-600 sm:grid-cols-3">
              <div>
                <dt className="font-medium text-ink-700">File</dt>
                <dd className="truncate" title={preview.fileName}>
                  {preview.fileName}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink-700">Size</dt>
                <dd>
                  {formatBytes(preview.size)}
                  {preview.originalSize && preview.originalSize !== preview.size ? (
                    <span className="text-ink-400"> (from {formatBytes(preview.originalSize)})</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink-700">Dimensions</dt>
                <dd>
                  {preview.width} x {preview.height} px
                  {preview.originalWidth && preview.originalHeight &&
                  (preview.originalWidth !== preview.width || preview.originalHeight !== preview.height) ? (
                    <span className="text-ink-400">
                      {' '}
                      (from {preview.originalWidth} x {preview.originalHeight} px)
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          ) : hasExisting ? (
            <p className="text-xs text-ink-600">A photo is attached to this employee.</p>
          ) : (
            <p className="text-xs text-ink-500">No photo selected.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50 focus-within:ring-2 focus-within:ring-brand-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {preview || hasExisting ? 'Replace photo' : 'Choose photo'}
              <input
                type="file"
                className="sr-only"
                accept={ACCEPTED_IMAGE_EXTENSIONS.join(',')}
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) onFile(file);
                }}
              />
            </label>

            {preview || hasExisting ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove photo
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
