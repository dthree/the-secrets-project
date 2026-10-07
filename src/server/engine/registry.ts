import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCss } from '../../shell/css.ts';
import type { PublicManifest, SecretModule } from '../../shared/secret.ts';
import { publicSecretLabel } from '../../shared/secret-label.ts';

export type Secret = {
  manifest: PublicManifest;
  module: SecretModule;
  dir: string;

  css: string | null;

  cssPath: string | null;

  beforePaint?: string | null;
};

export const tagIndex = (secrets: Secret[]): Record<string, number[]> => {
  const out: Record<string, number[]> = {};
  for (const s of secrets) {
    for (const t of s.module.tags ?? []) {
      (out[t] ??= []).push(s.manifest.n);
    }
  }
  return out;
};

const SECRETS_DIR = resolve('src/secrets');

let cache: Secret[] | null = null;

export const loadSecrets = async (): Promise<Secret[]> => {
  if (cache) { return cache; }

  const out: Secret[] = [];
  for (const dir of readdirSync(SECRETS_DIR).sort()) {
    const base = join(SECRETS_DIR, dir);
    const mPath = join(base, 'manifest.ts');
    const sPath = existsSync(join(base, 'secret.tsx'))
      ? join(base, 'secret.tsx')
      : join(base, 'secret.ts');
    if (!existsSync(mPath) || !existsSync(sPath)) { continue; }

    const declaredManifest = (await import(pathToFileURL(mPath).href)).manifest as PublicManifest;
    const module = (await import(pathToFileURL(sPath).href)).secret as SecretModule;

    const manifest = { ...declaredManifest, teaser: publicSecretLabel(declaredManifest) };
    if (module.developmentOnly && process.env.NODE_ENV !== 'development') continue;
    module.hasIsland = module.hasIsland !== false && existsSync(join(base, 'island.tsx'));

    const cssPath = join(base, 'style.css');

    const css = module.stylesEnabled !== false && existsSync(cssPath) ? readCss(cssPath) : null;
    const headPath = resolve('dist/islands', `${manifest.n}.head.js`);
    const beforePaint = existsSync(join(base, 'before-paint.ts')) && existsSync(headPath)
      ? readFileSync(headPath, 'utf8') : null;
    out.push({ beforePaint, manifest, module, dir, css, cssPath: css === null ? null : cssPath,

    });
  }

  validate(out);

  cache = out;
  return out;
};

export const validate = (secrets: Secret[]) => {
  const byN = new Map(secrets.map((s) => [s.manifest.n, s]));

  if (byN.size !== secrets.length) {
    throw new Error('duplicate secret numbers — numbers are permanent identities');
  }

  for (const s of secrets) {
    publicSecretLabel(s.manifest);
    if (!s.module.unlockExplanation?.trim()) {
      throw new Error(`secret ${s.manifest.n} needs a visitor-facing unlock explanation`);
    }
    for (const feature of s.module.unlocks ?? []) {
      if (!feature.title.trim() || !feature.description.trim() || !feature.icon.length) {
        throw new Error(`secret ${s.manifest.n} has an incomplete discovery feature`);
      }
    }
    for (const req of s.module.requires ?? []) {
      if (!byN.has(req)) {
        throw new Error(`secret ${s.manifest.n} requires ${req}, which does not exist`);
      }

      if (!s.module.creatorsOnly && !s.module.developmentOnly && byN.get(req)?.module.creatorsOnly) {
        throw new Error(`secret ${s.manifest.n} requires ${req}, which only the creators can find`);
      }
    }

    if (s.module.creatorsOnly && (s.module.tags?.some(t => t === 'farm' || t === 'scenery')
      || s.module.developmentOnly)) {
      throw new Error(`secret ${s.manifest.n} is creators-only, so it cannot be scenery or development-only`);
    }
  }

  for (const s of secrets) {
    for (const h of s.manifest.hintsUnlocked ?? []) {
      if (!byN.has(h.n)) {
        throw new Error(`secret ${s.manifest.n} hints at ${h.n}, which does not exist`);
      }
      if (h.n === s.manifest.n) {
        throw new Error(`secret ${s.manifest.n} hints at itself — an edge that can never be live`);
      }
      if (!s.module.creatorsOnly && !s.module.developmentOnly && byN.get(h.n)?.module.creatorsOnly) {
        throw new Error(`secret ${s.manifest.n} hints at ${h.n}, which only the creators can find`);
      }

      if (!!h.text === !!h.figure) {
        throw new Error(`secret ${s.manifest.n}'s hint about ${h.n} needs exactly one of text and figure`);
      }
    }

    const r = s.module.recurs;
    if (r && r.dow === undefined && r.date === undefined && !r.dates?.length) {
      throw new Error(`secret ${s.manifest.n} declares a recurrence with no day and no date`);
    }
    if (r?.date !== undefined && (r.date < 1 || r.date > 31)) {
      throw new Error(`secret ${s.manifest.n} recurs on date ${r.date}, which no month has`);
    }
    if (r?.dates && (!r.dates.length || r.dates.some(({ month, date }) =>
      !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(date)
      || date < 1 || date > new Date(Date.UTC(2000, month, 0)).getUTCDate()))) {
      throw new Error(`secret ${s.manifest.n} declares an invalid annual date`);
    }
    const { rootHint, rootFigure, n } = s.manifest;
    if (rootHint && rootFigure) {
      throw new Error(`secret ${n} has both a root hint and a root figure — a root says one thing`);
    }

    if (rootFigure && (!rootFigure.svg.trim() || !rootFigure.code.trim())) {
      throw new Error(`secret ${n}'s root figure needs both a drawing and a code`);
    }
  }

  const state = new Map<number, 'open' | 'done'>();
  const walk = (n: number, trail: number[]) => {
    if (state.get(n) === 'done') { return; }
    if (state.get(n) === 'open') {
      throw new Error(`prerequisite cycle: ${[...trail, n].join(' -> ')}`);
    }
    state.set(n, 'open');
    for (const req of byN.get(n)?.module.requires ?? []) {
      walk(req, [...trail, n]);
    }
    state.set(n, 'done');
  };
  for (const s of secrets) { walk(s.manifest.n, []); }
};
