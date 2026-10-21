/**
 * A check of the cloud reader.
 *
 * It shows how the serverless function answers a request that is not a photo
 * and how the values of the model are turned into the rows of the passbook
 * table. With GEMINI_API_KEY in the environment the last part sends a real
 * request to the model.
 *
 *   node scripts/check-cloud-ocr.mjs
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['server/ocr.ts', 'src/lib/cloudOcr.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  outdir: 'tmp-bundle',
  outbase: '.',
  alias: { '@': './src' },
  logLevel: 'error',
});

const { runPassbookOcr } = await import('../tmp-bundle/server/ocr.js');
const { cloudMatches } = await import('../tmp-bundle/src/lib/cloudOcr.js');

const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const small = Buffer.from('a'.repeat(64)).toString('base64');

console.log('no api key:');
console.log(' ', JSON.stringify(await runPassbookOcr({ image: small, mimeType: 'image/jpeg' })));

process.env.GEMINI_API_KEY = 'test-key';

console.log('\nno body:');
console.log(' ', JSON.stringify(await runPassbookOcr(null)));

console.log('\nwrong mime type:');
console.log(' ', JSON.stringify(await runPassbookOcr({ image: small, mimeType: 'image/gif' })));

console.log('\nnot base64:');
console.log(' ', JSON.stringify(await runPassbookOcr({ image: 'not base64!!', mimeType: 'image/jpeg' })));

console.log('\ntoo large:');
const huge = Buffer.alloc(5 * 1024 * 1024, 1).toString('base64');
console.log(' ', JSON.stringify(await runPassbookOcr({ image: huge, mimeType: 'image/jpeg' })));

console.log('\nvalid request with a wrong key:');
const result = await runPassbookOcr({ image: small, mimeType: 'image/jpeg' });
console.log('  ok =', result.ok, '| code =', result.ok ? '-' : result.code);
console.log('  message =', result.ok ? '-' : result.error.split('\n')[0]);
delete process.env.GEMINI_API_KEY;

console.log('\nvalues of the model:');
const matches = cloudMatches({
  bank_name: 'HDFC Bank',
  bank_account_no: '50100234567890',
  bank_ifsc_code: 'HDFC0000123',
  bank_branch_name: 'Koramangala',
  account_holder_name: 'RAMESH KUMAR',
  confidence: 0.92,
  notes: 'The account number is faint.',
  raw_text: 'A/c No. 50100234567890  IFSC HDFC0000123',
});
matches.forEach((match) => {
  console.log(`  ${match.key.padEnd(18)} = ${match.value}  ${match.warning ?? ''}`);
});

console.log('\nvalues that need a check:');
const broken = cloudMatches({
  bank_name: 'HDFC Bank',
  bank_account_no: '50100234',
  bank_ifsc_code: 'HDFCOOO123',
  bank_branch_name: '',
  account_holder_name: '',
  confidence: 0.3,
  notes: 'Faint print.',
  raw_text: '',
});
broken.forEach((match) => {
  console.log(`  ${match.key.padEnd(18)} = ${match.value}  ${match.warning ?? ''}`);
});
