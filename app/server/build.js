const esbuild = require('esbuild');
const { copy } = require('esbuild-plugin-copy');
const fs = require('fs');

/** pdf-parse → @napi-rs/canvas (native); must not be bundled into the JS file. */
const externalNapiCanvas = {
  name: 'external-napi-canvas',
  setup(build) {
    build.onResolve({ filter: /^@napi-rs\/canvas/ }, args => ({
      path: args.path,
      external: true
    }));
  }
};

// Build main server entry point
const buildMain = esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  outfile: './dist_server/index.js',
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
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  external: [
    // Exclude heavy processors from production bundle
  ],
  plugins: [
    externalNapiCanvas,
    copy({
      resolveFrom: 'cwd',
      assets: [
        {
          from: ['.env.dev'],
          to: ['./dist_server/.env.dev']
        },
        {
          from: ['.env.uat'],
          to: ['./dist_server/.env.uat']
        },
        {
          from: ['.env.prod'],
          to: ['./dist_server/.env.prod']
        },
        {
          from: ['.vertex-key.json'],
          to: ['./dist_server/.vertex-key.json']
        },
        {
          from: ['images/*'],
          to: ['dist_server/images']
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
});

// Execute build
buildMain
  .then(() => {
    console.log('✅ Build completed successfully');
    console.log(`📦 Main bundle: ./dist_server/index.js`);
  })
  .catch(err => {
    console.error('❌ Build failed:', err);
    return process.exit(1);
  });
