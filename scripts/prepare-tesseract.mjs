/**
 * Puts the OCR engine into the public folder.
 *
 * Without this the browser downloads the worker, the WebAssembly core and
 * the English language data from a CDN the first time a photo is read. On a
 * network that cannot reach the CDN the OCR simply does not start.
 *
 * The files are copied from the packages that are installed anyway, so the
 * repository stays small — the copies in `public/tesseract` are generated.
 *
 *   node scripts/prepare-tesseract.mjs
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'tesseract');

/** The files that are copied, from the package folder to the public folder. */
const FILES = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
];

/** The size of a file, or 0 when it does not exist. */
async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

let copied = 0;
let skipped = 0;

for (const [from, to] of FILES) {
  const source = join(root, 'node_modules', ...from.split('/'));
  const destination = join(target, ...to.split('/'));

  const sourceSize = await sizeOf(source);
  if (sourceSize === 0) {
    console.error(`  missing: node_modules/${from}`);
    skipped += 1;
    continue;
  }

  const destinationSize = await sizeOf(destination);
  if (destinationSize === sourceSize) {
    skipped += 1;
    continue;
  }

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`  ${to.padEnd(46)} ${Math.round(sourceSize / 1024).toString().padStart(6)} KB`);
  copied += 1;
}

console.log(`\n${copied} file(s) copied, ${skipped} already in place.`);
