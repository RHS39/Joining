/**
 * The contract of the cloud reader.
 *
 * The browser sends a photo to a small serverless function, the function asks
 * a multimodal model for the bank details and sends the answer back as JSON.
 *
 * This file is used by the browser and by the serverless function, so it must
 * not use the "@/" path alias and must not touch the browser APIs.
 */
import { z } from 'zod';

/** The model that reads the photo. Free on the free tier of the Gemini API. */
export const CLOUD_OCR_MODEL = 'gemini-3.8-flash';

/** Mime types the proxy accepts. */
export const CLOUD_OCR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Largest photo the proxy accepts, in bytes. */
export const CLOUD_OCR_MAX_BYTES = 4 * 1024 * 1024;

/** Why a cloud read failed. */
export type CloudOcrErrorCode =
  /** The function is running, but no API key is configured. */
  | 'not-configured'
  /** The request was not a usable photo. */
  | 'bad-request'
  /** The photo was too large. */
  | 'too-large'
  /** The model was called too often — the daily quota is used up. */
  | 'rate-limited'
  /** The model refused the request or the answer was not usable. */
  | 'model-failed'
  /** Something else went wrong. */
  | 'unknown';

/** The answer of the model. */
export const passbookCloudDataSchema = z.object({
  bank_name: z.string(),
  bank_account_no: z.string(),
  bank_ifsc_code: z.string(),
  bank_branch_name: z.string(),
  account_holder_name: z.string(),
  confidence: z.number(),
  notes: z.string(),
  raw_text: z.string(),
});

/** The answer of the model, checked. */
export type PassbookCloudData = z.infer<typeof passbookCloudDataSchema>;

/**
 * The JSON schema the model has to answer with.
 *
 * Every value is a string, because a passbook is a printed form: a value that
 * cannot be read is an empty string and never an invented one.
 */
export const PASSBOOK_CLOUD_SCHEMA = {
  type: 'object',
  properties: {
    bank_name: {
      type: 'string',
      description:
        'The name of the bank as it is printed, for example "State Bank of India" or "HDFC Bank". Empty when it is not visible.',
    },
    bank_account_no: {
      type: 'string',
      description:
        'The account number as digits only, without spaces, dots or dashes. A number that is printed in groups is joined. Empty when it is not visible.',
    },
    bank_ifsc_code: {
      type: 'string',
      description:
        'The 11 character IFSC code in upper case: four letters, then the digit 0, then six letters or digits. Empty when it is not visible.',
    },
    bank_branch_name: {
      type: 'string',
      description:
        'The name of the branch, for example "Koramangala". Not the full address. Empty when it is not visible.',
    },
    account_holder_name: {
      type: 'string',
      description: 'The name of the account holder. Empty when it is not visible.',
    },
    confidence: {
      type: 'number',
      description: 'How sure you are that the four bank details are right, from 0 to 1.',
    },
    notes: {
      type: 'string',
      description:
        'A short note in plain English about what was hard to read, or an empty string when everything was clear.',
    },
    raw_text: {
      type: 'string',
      description: 'The text of the passbook page as you read it, so that the user can check the values.',
    },
  },
  required: [
    'bank_name',
    'bank_account_no',
    'bank_ifsc_code',
    'bank_branch_name',
    'account_holder_name',
    'confidence',
    'notes',
    'raw_text',
  ],
} as const;

/** The request the browser sends to the proxy. */
export interface PassbookCloudRequest {
  /** The photo, base64 encoded, without a data url prefix. */
  image: string;
  /** The mime type of the photo. */
  mimeType: string;
}

/** The answer of the proxy. */
export type PassbookCloudResponse =
  | { ok: true; data: PassbookCloudData; model: string }
  | { ok: false; code: CloudOcrErrorCode; error: string };

/** The answer of the model, when the request was not a photo of a passbook. */
export const CLOUD_OCR_SYSTEM_PROMPT = [
  'You read Indian bank passbook photos and return the bank details as JSON.',
  'You are careful: you report what is printed on the photo, you never guess and you never repair a value by guessing.',
  'A value that is not visible or not readable is an empty string, and you say so in the notes.',
].join(' ');

/** The instruction that is sent with every photo. */
export const CLOUD_OCR_USER_PROMPT = [
  'Read the bank details out of this photo of a bank passbook.',
  '',
  'Rules:',
  '- The account number is printed as digits only. When it is printed in groups, separated by spaces, dots or dashes, join the groups into one number of 9 to 18 digits. Do not leave any space in the value.',
  '- The IFSC code has exactly 11 characters: four letters, then the digit 0, then six letters or digits. The fifth character is always the digit 0, never the letter O. A letter O and the digit 0 look the same in the print — use the rule above to tell them apart.',
  '- The bank name is the name of the bank itself, for example "HDFC Bank" or "State Bank of India", not the name of the branch.',
  '- The branch name is the name of the branch only, for example "Koramangala" or "Main Branch". It is not the address.',
  '- Copy the holder name as it is printed, in upper case letters.',
  '- When a value is missing, hidden, covered or unreadable, return an empty string for it. Never invent a value.',
].join('\n');
