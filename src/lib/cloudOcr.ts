/**
 * The browser side of the cloud reader.
 *
 * The photo is sent to a small serverless function, which asks a multimodal
 * model for the bank details. The function holds the API key, so the key
 * never reaches the browser.
 */
import { prepareImageForOcr } from './image';
import { PASSBOOK_TARGETS, readAccountNumber, readIfsc, type PassbookMatch } from './passbook';
import type { CloudOcrErrorCode, PassbookCloudData, PassbookCloudResponse } from './passbookCloud';

/** The longest side of the photo that is sent, in pixels. */
const CLOUD_OCR_MAX_SIDE = 2400;

/** The paths the function is looked for at. */
const ENDPOINTS = ['/api/ocr', '/.netlify/functions/ocr'];

/** The endpoint that answered the last time. */
let workingEndpoint: string | null = null;

/** What is known about the function. */
export type CloudReaderState = 'unknown' | 'available' | 'missing';

let readerState: CloudReaderState = 'unknown';

/** What is known about the function. */
export function cloudReaderState(): CloudReaderState {
  return readerState;
}

/** A cloud read that did not work out. */
export class CloudOcrError extends Error {
  /** Why the read failed. */
  readonly code: CloudOcrErrorCode;

  constructor(code: CloudOcrErrorCode, message: string) {
    super(message);
    this.name = 'CloudOcrError';
    this.code = code;
  }
}

/** The answer of the cloud reader. */
export interface CloudOcrOutcome {
  /** The values that were read. */
  data: PassbookCloudData;
  /** The model that read the photo. */
  model: string;
}

/** The endpoints that are tried, the one that worked first. */
function endpoints(): string[] {
  const configured = (import.meta.env.VITE_OCR_PROXY_URL as string | undefined)?.trim();
  const list = configured ? [configured, ...ENDPOINTS] : [...ENDPOINTS];
  if (!workingEndpoint) return list;
  return [workingEndpoint, ...list.filter((endpoint) => endpoint !== workingEndpoint)];
}

/** A blob as a base64 string, without a data url prefix. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Read the bank details out of a photo with the cloud reader.
 *
 * The photo is prepared for the model, sent to the function and the answer
 * is checked before it is handed back.
 */
export async function readPassbookWithCloud(file: File): Promise<CloudOcrOutcome> {
  const image = await prepareImageForOcr(file, CLOUD_OCR_MAX_SIDE);
  const payload = JSON.stringify({
    image: await blobToBase64(image),
    mimeType: image.type || 'image/jpeg',
  });

  let lastError = 'The cloud reader could not be reached.';

  for (const endpoint of endpoints()) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : lastError;
      continue;
    }

    let answer: PassbookCloudResponse;
    try {
      answer = (await response.json()) as PassbookCloudResponse;
    } catch {
      // The path answered with the page of the application — the function is
      // not deployed here.
      lastError = 'The cloud reader is not deployed for this address.';
      continue;
    }

    workingEndpoint = endpoint;
    readerState = 'available';

    if (answer.ok) return { data: answer.data, model: answer.model };
    throw new CloudOcrError(answer.code, answer.error);
  }

  readerState = 'missing';
  throw new CloudOcrError('unknown', lastError);
}

/** An IFSC code that is shaped right. */
function isIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
}

/** An account number that is shaped right. */
function isAccountNumber(value: string): boolean {
  return /^\d{9,18}$/.test(value);
}

/**
 * The values of the answer of the model as the matches of the passbook.
 *
 * The values are cleaned up the same way the values of the local reader are,
 * so that both can be shown in the same table.
 */
export function cloudMatches(data: PassbookCloudData): PassbookMatch[] {
  const accountNumber = readAccountNumber(data.bank_account_no);
  const ifsc = readIfsc(data.bank_ifsc_code) || data.bank_ifsc_code.trim().toUpperCase();

  const values: Record<string, string> = {
    bank_account_no: accountNumber,
    bank_ifsc_code: ifsc,
    bank_name: data.bank_name.trim(),
    bank_branch_name: data.bank_branch_name.trim(),
  };

  const matches: PassbookMatch[] = [];

  PASSBOOK_TARGETS.forEach((target) => {
    const value = values[target.key] ?? '';
    if (!value) return;

    const warning =
      target.key === 'bank_account_no' && !isAccountNumber(value)
        ? `The account number has ${value.replace(/\D/g, '').length} digits — check it.`
        : target.key === 'bank_ifsc_code' && !isIfsc(value)
          ? 'The IFSC code is not 11 characters — check it.'
          : undefined;

    matches.push({
      key: target.key,
      label: target.label,
      value,
      matchedText: data.raw_text.trim(),
      warning,
    });
  });

  return matches;
}
