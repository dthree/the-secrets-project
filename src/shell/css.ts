import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripCssComments } from '../shared/comments.ts';

export const readCss = (path: string): string => stripCssComments(readFileSync(path, 'utf8'));
