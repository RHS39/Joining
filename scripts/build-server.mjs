/**
 * Builds the node web service that Render runs.
 *
 * The service is bundled into one file, `dist-server/render.js`, so that
 * `node dist-server/render.js` is all the start command needs.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['server/render.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // The packages of node_modules are used as they are.
  packages: 'external',
  outfile: 'dist-server/render.js',
  logLevel: 'error',
});


const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

/*console.log('The web service is built: dist-server/render.js');
*/