import { iconBoundary } from './icon-boundary.ts';
import { disclosureBoundary } from './disclosure-boundary.ts';

import { build, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { bare } from './comments.ts';

const SECRETS_DIR = 'src/secrets';
const OUT = 'dist/islands';
const onlyIndex=process.argv.indexOf('--only'),only=onlyIndex<0?undefined:process.argv[onlyIndex+1];
if(onlyIndex>=0&&(!only||!/^\d+$/.test(only)))throw new Error('Pass one secret number after --only');

const entries: Array<[string, string]> = [];
for (const dir of readdirSync(SECRETS_DIR)) {
  const island = join(SECRETS_DIR, dir, 'island.tsx');
  if (!existsSync(island)) { continue; }

  const n = Number(dir.split('-')[0]);
  if (!Number.isInteger(n)) { continue; }
  if(only!==undefined&&String(n)!==only)continue;
  entries.push([String(n), island]);
}

if(!entries.length)throw new Error('No matching island');
if(only===undefined)rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const VENDOR = 'dist/vendor';
const threeSource = readFileSync('node_modules/three/build/three.module.min.js');
const threeFile = `three.${createHash('sha256').update(threeSource).digest('hex').slice(0, 12)}.js`;
mkdirSync(VENDOR, { recursive: true });

if (!existsSync(join(VENDOR, threeFile))) writeFileSync(join(VENDOR, threeFile), threeSource);
if (only === undefined) for (const f of readdirSync(VENDOR)) if (f !== threeFile) rmSync(join(VENDOR, f), { force: true });
const THREE_URL = `/v/${threeFile}`;

const threeVendor = (): Plugin => ({
  name: 'three-vendor',
  enforce: 'pre',
  resolveId: id => (id === 'three' ? '\0three' : null),
  load: id => (id === '\0three'
    ? { code: `const url = ${JSON.stringify(THREE_URL)};\nexport default await import(/* @vite-ignore */ url);`, syntheticNamedExports: true }
    : null),
});

for (const [n, entry] of entries) {
  await build({
    configFile: false,

    publicDir: false,
    logLevel: 'warn',

    plugins: [threeVendor(), iconBoundary(), bare(), disclosureBoundary()],

    esbuild: { supported: { 'top-level-await': true } },
    build: {
      outDir: OUT,
      emptyOutDir: false,
      minify: /^\/\/ @minify\b/.test(readFileSync(entry, 'utf8')) ? 'esbuild' : false,
      rollupOptions: {
        input: { [n]: entry },

        preserveEntrySignatures: 'exports-only',
        output: {
          format: 'es',
          entryFileNames: '[name].js',

          inlineDynamicImports: true,
        },
      },
    },
  });
  for (const [source, suffix] of [['before-paint.ts', 'head'], ['profile-client.ts', 'profile'], ['stage-client.ts', 'stage']]) {
    const extra = join(dirname(entry), source);
    if (existsSync(extra)) {
      await build({
        configFile: false, publicDir: false, logLevel: 'warn', plugins: [iconBoundary(), bare(), disclosureBoundary()],
        build: { outDir: OUT, emptyOutDir: false, minify: false,
          rollupOptions: { input: extra,
            preserveEntrySignatures: 'exports-only',
            output: { format: suffix === 'stage' ? 'es' : 'iife', entryFileNames: `${n}.${suffix}.js`, inlineDynamicImports: true } } },
      });
    } else {
      rmSync(join(OUT, `${n}.${suffix}.js`), { force: true });
    }
  }
}

const files = readdirSync(OUT);
const stray = files.filter((f) => !/^\d+(?:\.(?:head|profile|stage))?\.js$/.test(f));
if (stray.length > 0) {
  throw new Error(`${OUT} must contain only <number>.js, <number>.head.js <number>.profile.js or <number>.stage.js — found ${stray.join(', ')}`);
}

const importing = files.filter((f) => /(^|\n)\s*import[\s{'"*]/.test(readFileSync(join(OUT, f), 'utf8')));
if (importing.length > 0) {
  throw new Error(
    `islands must be self-contained — ${importing.join(', ')} import something. `
    + 'The gated route serves one file per secret; there is nowhere to fetch a sibling from.',
  );
}

const loading = files.filter((f) => {
  const code = readFileSync(join(OUT, f), 'utf8');
  const loads = code.match(/\bimport\s*\(/g)?.length ?? 0;
  return loads > (code.includes(JSON.stringify(THREE_URL)) ? 1 : 0);
});
if (loading.length > 0) {
  throw new Error(`islands may load nothing but ${THREE_URL}, and ${loading.join(', ')} load something else.`);
}

const sizes = files.filter(f=>only===undefined||f===only+'.js')
  .map((f) => [f, readFileSync(join(OUT, f)).length] as const)
  .sort((a, b) => a[1] - b[1]);
for (const [f, size] of sizes) {
  console.log(`  ${f.padEnd(9)} ${(size / 1024).toFixed(1)} kB`);
}
console.log(`islands: ${files.length}, all self-contained`);
