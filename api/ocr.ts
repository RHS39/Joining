/**
 * The cloud reader as a serverless function of Vercel.
 *
 * The function holds the API key of the Gemini API, so the key never reaches
 * the browser. The browser posts a photo here and gets the bank details back.
 */
import type { ServerResponse } from 'node:http';
import { readJsonBody, type BodyRequest } from '../server/http';
import { runPassbookOcr } from '../server/ocr';

/** The headers of the answer. */
function headers(): Record<string, string> {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
}

/** The status of the answer. */
function status(code: string): number {
  if (code === 'not-configured') return 503;
  if (code === 'rate-limited') return 429;
  return 400;
}

export default async function handler(req: BodyRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers(), allow: 'POST' });
    res.end(JSON.stringify({ ok: false, code: 'bad-request', error: 'Only POST is allowed.' }));
    return;
  }

  let body: unknown = null;
  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400, headers());
    res.end(JSON.stringify({ ok: false, code: 'bad-request', error: 'The request is not valid JSON.' }));
    return;
  }

  const result = await runPassbookOcr(body);
  res.writeHead(result.ok ? 200 : status(result.code), headers());
  res.end(JSON.stringify(result));
}
