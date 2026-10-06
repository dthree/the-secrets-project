export type CommentMode = 'sheet' | 'embedded';

export const stripCssComments = (text: string, mode: CommentMode = 'sheet'): string => {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && text[j] !== c) { if (text[j] === '\\') { j++; } j++; }
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      if (e >= 0) { i = e + 2; continue; }
      if (mode === 'sheet') { break; }
      out += c;
      i++;
      continue;
    }
    if (c === 'u' && text.startsWith('url(', i) && !/[\w-]/.test(text[i - 1] ?? '')) {
      let j = text.indexOf(')', i);
      if (j < 0) { j = n - 1; }
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  if (mode === 'embedded') { return out; }
  return out.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').replace(/^\n/, '');
};

export const stripMarkupComments = (text: string): string =>
  text.replace(/<!--[\s\S]*?-->/g, '');

export const stripEmbeddedComments = (text: string): string =>
  stripMarkupComments(stripCssComments(text, 'embedded'));
