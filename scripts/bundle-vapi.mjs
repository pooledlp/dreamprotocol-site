import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

await build({
  entryPoints:[path.join(root,'assets/vapi-entry.js')],
  bundle:true,
  minify:true,
  format:'iife',
  platform:'browser',
  target:['es2020'],
  outfile:path.join(root,'assets/vapi.bundle.js'),
  legalComments:'none',
  sourcemap:false,
  logLevel:'warning'
});

console.log('Bundled @vapi-ai/web 2.7.1 for same-origin browser delivery.');
