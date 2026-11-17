import { build } from 'esbuild';
await build({
  entryPoints: { 'wealth-sim': 'agent/cli.ts' },
  outdir: 'dist-agent',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
console.log('dist-agent/wealth-sim.mjs gebaut');
