const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');
const fs = require('fs');

/** pdf-parse pulls in @napi-rs/canvas (native .node binaries); esbuild cannot bundle those. */
const externalNapiCanvas = {
  name: 'external-napi-canvas',
  setup(build) {
    build.onResolve({ filter: /^@napi-rs\/canvas/ }, args => ({
      path: args.path,
      external: true
    }));
  }
};

/**
 * EC2 Build Script
 *
 * Creates a single bundled JS for EC2. Most deps are inlined; native addons
 * (e.g. @napi-rs/canvas from pdf-parse) stay external — install production
 * deps on the instance (or copy node_modules built on Linux for that arch).
 */

esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  outfile: './dist/index.js',
  platform: 'node',
  treeShaking: true,
  minify: true,
  // Some bundled dependencies (e.g. the `abort-controller` polyfill used by
  // @google-cloud/storage's resumable upload) duck-type on `Class.name`
  // (e.g. `signal.constructor.name === 'AbortSignal'`) instead of using
  // `instanceof`. Identifier minification renames those classes, breaking
  // the check and causing runtime errors like "Expected signal to be an
  // instanceof AbortSignal" (see library-item-processing video embedding
  // uploads). keepNames preserves the original names post-minification.
  keepNames: true,
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  // Bundle most dependencies; native modules need `npm install` on EC2 (see package.ec2.json + after-install.sh)
  external: [
    // Only exclude development dependencies
    'nodemon',
    'ts-node',
    'typescript',
    'vitest',
    '@types/*',
    // Exclude native modules that can't be bundled
    'sharp',
    'canvas',
    // Exclude generation processor from production bundle
    './services/generation-processor',
    './services/export/export-processor',
    './services/export/export-fcp'
  ],
  plugins: [
    externalNapiCanvas,
    copy({
      resolveFrom: 'cwd',
      assets: [
        {
          from: ['images/*'],
          to: ['dist/images']
        }
      ],
      watch: false
    })
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.IS_PROD': '"true"'
  },
  mainFields: ['main', 'module'],
  conditions: ['node']
})
  .then(() => {
    console.log('✅ EC2 Build completed successfully');
    console.log(`📦 Bundle: ./dist/index.js`);
    
    // Show bundle size
    const stats = fs.statSync('./dist/index.js');
    console.log(`📊 Bundle size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  })
  .catch(err => {
    console.error('❌ Build failed:', err);
    return process.exit(1);
  });
