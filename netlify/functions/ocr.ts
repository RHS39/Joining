/**
 * The cloud reader as a serverless function of Netlify.
 *
 * The function holds the API key of the Gemini API, so the key never reaches
 * the browser. The browser posts a photo here and gets the bank details back.
 */
import { runPassbookOcr } from '../../server/ocr';

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, code: 'bad-request', error: 'Only POST is allowed.' }), {
      status: 405,
      headers: { ...headers, allow: 'POST' },
    });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, code: 'bad-request', error: 'The request is not valid JSON.' }), {
      status: 400,
      headers,
    });
  }

  const result = await runPassbookOcr(body);
  const code = result.ok ? 200 : result.code;
  const status = code === 'not-configured' ? 503 : code === 'rate-limited' ? 429 : 400;
  return new Response(JSON.stringify(result), { status, headers });
}
