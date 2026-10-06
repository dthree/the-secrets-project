import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { stripEmbeddedComments } from '../src/shared/comments.ts';

export type Span = { pos: number; end: number };

const parse = (code: string) =>
  ts.createSourceFile('chunk.js', code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

const tokens = (sf: ts.SourceFile): ts.Node[] => {
  const out: ts.Node[] = [];
  const visit = (n: ts.Node) => {
    const kids = n.getChildren(sf);
    if (kids.length === 0) { out.push(n); return; }
    kids.forEach(visit);
  };
  visit(sf);
  return out;
};

export const jsComments = (code: string, sf = parse(code)): Span[] => {
  const seen = new Map<number, Span>();
  for (const t of tokens(sf)) {
    for (const r of [
      ...(ts.getLeadingCommentRanges(code, t.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(code, t.end) ?? []),
    ]) {
      seen.set(r.pos, { pos: r.pos, end: r.end });
    }
  }
  return [...seen.values()].sort((a, b) => a.pos - b.pos);
};

const stringSpans = (sf: ts.SourceFile): Span[] => {
  const out: Span[] = [];
  for (const t of tokens(sf)) {
    const start = t.getStart(sf);
    switch (t.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        out.push({ pos: start + 1, end: t.end - 1 }); break;
      case ts.SyntaxKind.TemplateHead:
        out.push({ pos: start + 1, end: t.end - 2 }); break;
      case ts.SyntaxKind.TemplateMiddle:
        out.push({ pos: start + 1, end: t.end - 2 }); break;
      case ts.SyntaxKind.TemplateTail:
        out.push({ pos: start + 1, end: t.end - 1 }); break;
      default: break;
    }
  }
  return out;
};

export const stripJs = (code: string): string => {
  const sf = parse(code);
  const edits: Array<Span & { text: string }> = jsComments(code, sf).map((c) => ({ ...c, text: '' }));
  for (const s of stringSpans(sf)) {
    const raw = code.slice(s.pos, s.end);
    const bare = stripEmbeddedComments(raw);
    if (bare !== raw) { edits.push({ ...s, text: bare }); }
  }
  edits.sort((a, b) => a.pos - b.pos);
  let out = '';
  let at = 0;
  for (const e of edits) {
    out += code.slice(at, e.pos) + e.text;
    at = e.end;
  }
  return out + code.slice(at);
};

export const bare = (): Plugin => ({
  name: 'bare',
  writeBundle(options, bundle) {
    const dir = options.dir ?? (options.file ? dirname(options.file) : undefined);
    if (!dir) { throw new Error('bare(): output has neither dir nor file'); }
    for (const out of Object.values(bundle)) {
      if (out.type !== 'chunk') { continue; }
      const path = join(dir, out.fileName);
      writeFileSync(path, stripJs(readFileSync(path, 'utf8')));
    }
  },
});
