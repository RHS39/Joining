/**
 * The application as a node web service.
 *
 * Render has no serverless functions, so the whole application is one small
 * service: it serves the built application out of `dist` and answers the
 * request of the cloud reader at `/api/ocr`.
 *
 *   node dist-server/render.js
 */
import { createReadStream } from 'node:fs';
import { appendFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { readJsonBody } from './http';
import { runPassbookOcr } from './ocr';

/** The folder the built application is in. */
const staticRoot = resolve(process.env.STATIC_DIR ?? join(process.cwd(), 'dist'));

/** The port the service listens on. */
const port = Number(process.env.PORT ?? 10000);

/** The folder the application is published under. */
const base = (process.env.BASE_PATH ?? '/').trim() || '/';
const prefix = base === '/' ? '/' : base.endsWith('/') ? base : `${base}/`;

/** The types of the files that are served. */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
  '.traineddata': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * The headers of the answer.
 *
 * The language data of the OCR is served without `Content-Encoding`, so that
 * the engine unpacks it itself — that way only the small packed file is
 * sent over the line.
 */
function headersFor(path: string): Record<string, string> {
  const type = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
  const cache = path.includes(`${sep}assets${sep}`) || path.includes(`${sep}tesseract${sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
  return { 'content-type': type, 'cache-control': cache };
}

/** The headers of a request from another address. */
function corsHeaders(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin;
  if (!origin) return {};

  const allowed = (process.env.OCR_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowed.includes(origin)) return {};

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}

/** The answer of the cloud reader. */
function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(text)),
    'cache-control': 'no-store',
    ...extra,
  });
  res.end(text);
}

/** The path of a file inside the built application — or nothing, when it is outside. */
function safePath(urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const candidate = resolve(staticRoot, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  if (candidate !== staticRoot && !candidate.startsWith(staticRoot + sep)) return null;
  return candidate;
}

/** Send a file, when there is one. */
async function sendFile(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  let info;
  try {
    info = await stat(path);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  res.writeHead(200, { ...headersFor(path), 'content-length': String(info.size) });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  createReadStream(path).pipe(res);
  return true;
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    let path = url.pathname;

    // Record successful demo sign-ins without ever receiving or storing passwords.
    if (path === `${prefix}api/login-log` || path === '/api/login-log') {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'Only POST is allowed.' });
        return;
      }

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        json(res, 400, { ok: false, error: 'The request is not valid JSON.' });
        return;
      }

      const loginId = body && typeof body === 'object' && 'loginId' in body
        ? body.loginId
        : null;
      if (
        typeof loginId !== 'string' ||
        !loginId.trim() ||
        loginId.trim().length > 128 ||
        /[\u0000-\u001f\u007f]/.test(loginId)
      ) {
        json(res, 400, { ok: false, error: 'A valid login ID is required.' });
        return;
      }

      try {
        await appendFile(
          join(process.cwd(), 'login-times.txt'),
          `${new Date().toISOString()}\t${loginId.trim()}\n`,
          'utf8',
        );
      } catch (error) {
        console.error('Could not record a successful sign-in.', error);
        json(res, 500, { ok: false, error: 'The login time could not be recorded.' });
        return;
      }

      json(res, 200, { ok: true });
      return;
    }

    // The cloud reader.
    if (path === `${prefix}api/ocr` || path === '/api/ocr') {
      const cors = corsHeaders(req);

      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        json(res, 405, { ok: false, code: 'bad-request', error: 'Only POST is allowed.' }, cors);
        return;
      }

      let body: unknown = null;
      try {
        body = await readJsonBody(req);
      } catch {
        json(res, 400, { ok: false, code: 'bad-request', error: 'The request is not valid JSON.' }, cors);
        return;
      }

      const result = await runPassbookOcr(body);
      const code = result.ok ? 200 : result.code;
      const status = code === 'not-configured' ? 503 : code === 'rate-limited' ? 429 : 400;
      json(res, status, result, cors);
      return;
    }

    // The application.
    if (prefix !== '/' && path.startsWith(prefix)) path = `/${path.slice(prefix.length)}`;

    const file = safePath(path);
    if (file && (await sendFile(req, res, file))) return;

    // Everything that is not a file is the application itself.
    const page = join(staticRoot, 'index.html');
    if (await sendFile(req, res, page)) return;

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  })().catch(() => {
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('Something went wrong');
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`The application is served on port ${port} (folder ${staticRoot}).`);
});
