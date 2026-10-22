/**
 * The HTTP helpers that the functions and the web service share.
 */
import type { IncomingMessage } from 'node:http';

/** The largest request body that is read, in bytes. */
export const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** The request of a runtime — some of them add the parsed body. */
export type BodyRequest = IncomingMessage & { body?: unknown };

/**
 * The body of a request, whatever the runtime put into it.
 *
 * The runtime of Vercel parses the body of a JSON request itself, the
 * runtime of Netlify and of node does not.
 */
export async function readJsonBody(req: BodyRequest): Promise<unknown> {
  const body = req.body;
  if (typeof body === 'string') return JSON.parse(body) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body) && !ArrayBuffer.isView(body)) return body;

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('The request is too large.');
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return null;
  return JSON.parse(text) as unknown;
}
