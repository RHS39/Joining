/**
 * Temporary check: an outdated stored template is detected and replaced.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/lib/templates.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: 'tmp-bundle',
  outbase: 'src/lib',
  alias: { '@': './src' },
  logLevel: 'error',
});

const { isOutdatedTemplate, createDefaultCustomFields, JOINING_FORM_TEMPLATE } = await import(
  './tmp-bundle/templates.js'
);

const current = createDefaultCustomFields();
const old = current.map((field) =>
  field.key === 'name_of_contractor' ? { ...field, type: 'text', options: undefined } : field,
);

const cases = [
  ['current fields + current categories', current, ['Casual', 'Piece Rate']],
  ['old fields + old categories', old, ['Permanent', 'Probation', 'Contract', 'Trainee', 'Intern', 'Consultant']],
  ['old fields + current categories', old, ['Casual', 'Piece Rate']],
  ['current fields + old categories', current, ['Permanent', 'Probation', 'Contract', 'Trainee', 'Intern', 'Consultant']],
  ['current fields + no categories', current, []],
];

cases.forEach(([name, fields, categories]) => {
  console.log(`  ${String(name).padEnd(36)} outdated = ${isOutdatedTemplate(fields, categories)}`);
});

console.log('\ncustom fields (the user added one):');
console.log('  outdated =', isOutdatedTemplate([...current, { key: 'own', label: 'Own', type: 'text' }], ['Casual', 'Piece Rate']));

console.log('\ntemplate categories:', JOINING_FORM_TEMPLATE.categories);
console.log('template default category:', JOINING_FORM_TEMPLATE.preferences?.defaultCategory);
console.log('contractor options:', current.find((field) => field.key === 'name_of_contractor')?.options);
