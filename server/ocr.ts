/**
 * The cloud reader: a photo goes in, the bank details come out.
 *
 * This module is the heart of the serverless function — it knows nothing
 * about HTTP, so that the same code can run on Vercel, on Netlify and on any
 * other node runtime.
 */
import { GoogleGenAI } from '@google/genai';
import {
  CLOUD_OCR_MAX_BYTES,
  CLOUD_OCR_MIME_TYPES,
  CLOUD_OCR_MODEL,
  CLOUD_OCR_SYSTEM_PROMPT,
  CLOUD_OCR_USER_PROMPT,
  PASSBOOK_CLOUD_SCHEMA,
  passbookCloudDataSchema,
  type CloudOcrErrorCode,
  type PassbookCloudData,
  type PassbookCloudResponse,
} from '../src/lib/passbookCloud';

/** The API key of the Gemini API. It is only ever read on the server. */
function apiKey(): string {
  return (process.env.GEMINI_API_KEY ?? '').trim();
}

/** The model that reads the photo. */
function model(): string {
  return (process.env.GEMINI_MODEL ?? '').trim() || CLOUD_OCR_MODEL;
}

/** The error of a failed request. */
function failure(code: CloudOcrErrorCode, error: string): PassbookCloudResponse {
  return { ok: false, code, error };
}

/** The size of a base64 string in bytes. */
function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** The photo of the request, when the request carries a usable one. */
function readPhoto(body: unknown): { image: string; mimeType: string } | { error: string; code: CloudOcrErrorCode } {
  if (!body || typeof body !== 'object') {
    return { error: 'The request has no photo.', code: 'bad-request' };
  }

  const record = body as Record<string, unknown>;
  const image = typeof record.image === 'string' ? record.image.trim() : '';
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType.trim() : '';

  if (!image) return { error: 'The request has no photo.', code: 'bad-request' };
  if (!CLOUD_OCR_MIME_TYPES.includes(mimeType as (typeof CLOUD_OCR_MIME_TYPES)[number])) {
    return { error: `The photo has the unsupported type "${mimeType || 'unknown'}".`, code: 'bad-request' };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return { error: 'The photo is not base64 encoded.', code: 'bad-request' };
  }
  if (base64Bytes(image) > CLOUD_OCR_MAX_BYTES) {
    return { error: 'The photo is too large.', code: 'too-large' };
  }

  return { image, mimeType };
}

/** The message of an error of the Gemini API. */
function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    const status = (cause as { status?: number }).status;
    if (status === 400 || status === 401 || status === 403) {
      return `The cloud reader was refused (error ${status}). The API key of the server is probably wrong or the request was not accepted.`;
    }
    if (typeof status === 'number') return `The model answered with the error ${status}: ${cause.message}`;
    return cause.message;
  }
  return String(cause);
}

/** The code of the error of the Gemini API. */
function errorCode(cause: unknown): CloudOcrErrorCode {
  const status = (cause as { status?: number } | null)?.status;
  if (status === 429) return 'rate-limited';
  if (status === 400 || status === 401 || status === 403) return 'bad-request';
  return 'model-failed';
}

/**
 * Read the bank details out of a photo of a passbook.
 *
 * The photo is never written to a disk: it goes straight from the request
 * into the model and the answer goes straight back.
 */
export async function runPassbookOcr(body: unknown): Promise<PassbookCloudResponse> {
  const key = apiKey();
  if (!key) {
    return failure('not-configured', 'No GEMINI_API_KEY is configured on the server.');
  }

  const photo = readPhoto(body);
  if ('error' in photo) return failure(photo.code, photo.error);

  const client = new GoogleGenAI({ apiKey: key });

  try {
    const interaction = await client.interactions.create({
      model: model(),
      system_instruction: CLOUD_OCR_SYSTEM_PROMPT,
      input: [
        { type: 'text', text: CLOUD_OCR_USER_PROMPT },
        { type: 'image', data: photo.image, mime_type: photo.mimeType },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: PASSBOOK_CLOUD_SCHEMA,
      },
      // The photo holds an account number, so nothing is kept on the server
      // side of the model.
      store: false,
      generation_config: { temperature: 0 },
    });

    const text = interaction.output_text;
    if (!text) {
      return failure('model-failed', 'The model did not return an answer.');
    }

    const parsed = passbookCloudDataSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return failure('model-failed', 'The answer of the model did not have the expected shape.');
    }

    const data: PassbookCloudData = parsed.data;
    return { ok: true, data, model: model() };
  } catch (cause) {
    return failure(errorCode(cause), errorMessage(cause));
  }
}
