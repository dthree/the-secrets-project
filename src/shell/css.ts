import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripCssComments } from '../shared/comments.ts';

export const readCss = (path: string): string => {
  let css = stripCssComments(readFileSync(path, 'utf8'));

  return css;
};
