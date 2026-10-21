/**
 * The cloud reader as a serverless function of Vercel.
 *
 * The function holds the API key of the Gemini API, so the key never reaches
 * the browser. The browser posts a photo here and gets the bank details back.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { runPassbookOcr } from '../server/ocr';

/** The request of the runtime — it adds the parsed body to the node request. */
type FunctionRequest = IncomingMessage & { body?: unknown };

/** The body of a request, whatever the runtime put into it. */
async function readBody(req: FunctionRequest): Promise<unknown> {
  const body = req.body;
  if (typeof body === 'string') return JSON.parse(body) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body) && !ArrayBuffer.isView(body)) return body;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

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

export default async function handler(req: FunctionRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers(), allow: 'POST' });
    res.end(JSON.stringify({ ok: false, code: 'bad-request', error: 'Only POST is allowed.' }));
    return;
  }

  let body: unknown = null;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, headers());
    res.end(JSON.stringify({ ok: false, code: 'bad-request', error: 'The request is not valid JSON.' }));
    return;
  }

  const result = await runPassbookOcr(body);
  res.writeHead(result.ok ? 200 : status(result.code), headers());
  res.end(JSON.stringify(result));
}
