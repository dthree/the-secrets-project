import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const privateClientModule = (id: string): boolean => {
  const parts = id.split('?')[0].replaceAll('\\', '/').split('/');
  const root = parts.lastIndexOf('src');
  if (root < 0) return false;
  return parts[root + 1] === 'server'
    || /\.server\.[cm]?[jt]sx?$/.test(parts.at(-1) ?? '')
    || (parts[root + 1] === 'secrets' && parts.length === root + 4 && /^(?:secret|manifest)\.tsx?$/.test(parts[root + 3]));
};

export const disclosureBoundary = (): Plugin => ({
  name: 'disclosure-boundary',
  generateBundle(_options, bundle) {
    for (const out of Object.values(bundle)) {
      if (out.type !== 'chunk') continue;
      for (const [id, info] of Object.entries(out.modules)) {
        const source = id.split('?')[0];
        const marked = info.renderedLength > 0 && !id.startsWith('\0') && !id.includes('/node_modules/')
          && /(?:^|\n)\s*(?:\/\/|\/\*\*?)\s*@server-only\b/.test(readFileSync(source, 'utf8'));
        if (info.renderedLength > 0 && (privateClientModule(id) || marked)) {
          this.error(`${out.fileName} includes server-only discovery code: ${relative(process.cwd(), id)}`);
        }
      }
    }
  },
  writeBundle: {
    order: 'post', sequential: true,
    handler(options, bundle) {
      const dir = options.dir ?? (options.file ? dirname(options.file) : undefined);
      if (!dir) throw Error('Disclosure receipt needs an output directory');
      mkdirSync('dist/disclosure', { recursive: true });
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk') continue;
        const file = relative(process.cwd(), resolve(dir, out.fileName));
        const modules = Object.entries(out.modules).filter(([, info]) => info.renderedLength > 0)
          .filter(([id]) => !id.startsWith('\0') && !id.includes('/node_modules/'))
          .map(([id, info]) => {
            const source = id.split('?')[0];
            return { file: relative(process.cwd(), source), bytes: info.renderedLength, sha256: hash(readFileSync(source)) };
          }).sort((a, b) => a.file.localeCompare(b.file));
        const bytes = readFileSync(resolve(file));
        const receipt = join('dist/disclosure', `${encodeURIComponent(file)}.json`);
        const temporary = `${receipt}.${process.pid}.tmp`;
        writeFileSync(temporary, JSON.stringify({ file, bytes: bytes.length, sha256: hash(bytes), modules }, null, 2) + '\n');
        renameSync(temporary, receipt);
      }
    },
  },
});
