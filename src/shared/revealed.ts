import type { Durable } from './secret.ts';

export const revealedKey = (n: number): string => `revealed:${n}`;
export const isRevealed = (durable: Pick<Durable, 'tally'>, n: number): boolean =>
  (durable.tally[revealedKey(n)] ?? 0) > 0;
