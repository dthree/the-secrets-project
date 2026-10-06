import type { PublicManifest } from './secret.ts';

export const publicSecretLabel = (manifest: Pick<PublicManifest, 'n' | 'teaser'>): string => {
  if (typeof manifest.teaser !== 'string' || !manifest.teaser.trim()) {
    throw new Error(`secret ${manifest.n} needs a nonempty teaser; use its secret name when no separate teaser is intended`);
  }
  return manifest.teaser.trim();
};
