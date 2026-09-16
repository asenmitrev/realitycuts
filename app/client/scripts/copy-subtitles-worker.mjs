import { copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

let packageDir;
try {
  packageDir = dirname(require.resolve('libass-wasm/package.json'));
} catch {
  console.warn(
    '[copy-subtitles-worker] libass-wasm is not installed - subtitle rendering will fail to load its worker. Run `yarn install`.'
  );
  process.exit(0);
}

const src = join(packageDir, 'dist/js/subtitles-octopus-worker.js');
const dest = join(clientRoot, 'public/subtitles-octopus-worker.js');

if (!existsSync(src)) {
  console.warn(`[copy-subtitles-worker] ${src} not found in libass-wasm package - subtitle rendering will fail to load its worker.`);
  process.exit(0);
}

copyFileSync(src, dest);
console.log('[copy-subtitles-worker] copied subtitles-octopus-worker.js into public/');
