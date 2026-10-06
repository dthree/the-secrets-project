import { isRevealed } from '../../shared/revealed.ts';
import { Fragment, createElement, type ReactNode } from 'react';
import type { Model, SlotCtx, SlotMap, RenderContribution, SlotRenderer } from '../../shared/secret.ts';
import type { Secret } from './registry.ts';

export const CORE_SLOTS = [
  'home.above',
  'home.center',
  'chrome.topLeft',
  'chrome.topCenter',
  'chrome.topRight',
  'chrome.tools',
  'chrome.beforeDiscoveries',
  'chrome.account',
  'chrome.status',
  'chrome.bottom',

  'credits.rows',

  'credits.footer',
] as const;

const MAX_DEPTH = 12;

export const compose = (
  pool: Secret[],
  unlocked: ReadonlySet<number>,
  ctx: SlotCtx,
): Model => {
  let secrets = pool;

  const held = secrets.filter((s) => unlocked.has(s.manifest.n));

  const declared = new Set<string>(CORE_SLOTS);
  for (const s of held) {
    for (const slot of s.module.declaresSlots ?? []) { declared.add(slot); }

    for (const c of s.module.contributions ?? []) {
      if (c.kind === 'render' && c.slot.startsWith('route:')) { declared.add(c.slot); }
    }
  }

  let bySlot: SlotMap = new Map();
  for (const slot of declared) { bySlot.set(slot, []); }

  const transforms: Array<{ priority: number; apply: (m: SlotMap, c: SlotCtx) => SlotMap }> = [];

  for (const s of held) {
    for (const c of s.module.contributions ?? []) {
      if (c.kind === 'transform') { transforms.push(c); continue; }
      const bucket = bySlot.get(c.slot);
      if (!bucket) { continue; }
      bucket.push({ priority: c.priority, n: s.manifest.n, c });
    }
  }

  for (const s of secrets) {
    if (!s.module.reveal || unlocked.has(s.manifest.n) || !isRevealed(ctx.durable, s.manifest.n)) { continue; }
    for (const c of s.module.reveal?.contributions ?? []) {
      if (!(CORE_SLOTS as readonly string[]).includes(c.slot)) { continue; }
      bySlot.get(c.slot)?.push({ priority: c.priority, n: s.manifest.n, c });
    }
  }

  for (const bucket of bySlot.values()) {
    bucket.sort((a, b) => a.priority - b.priority || a.n - b.n);
  }

  for (const t of transforms.sort((a, b) => a.priority - b.priority)) {
    try {
      bySlot = t.apply(bySlot, ctx);
    } catch {

    }
  }

  const renderer = (depth: number): SlotRenderer => Object.assign(
    (name: string, owner?: number) => renderAt(name, depth, owner),
    { entries: (name: string) => !declared.has(name) ? [] : secrets.flatMap((s) =>
      (s.module.contributions ?? []).flatMap((c) => c.kind === 'render' && c.slot === name
        ? [{ n: s.manifest.n, priority: c.priority, held: unlocked.has(s.manifest.n),
          ...(unlocked.has(s.manifest.n) ? { css: s.css } : {}) }]
        : []),
    ).sort((a, b) => a.priority - b.priority || a.n - b.n) },
  );
  const renderAt = (name: string, depth: number, owner?: number): ReactNode => {
    if (depth > MAX_DEPTH) { return null; }
    const bucket = bySlot.get(name);
    if (!bucket) { return null; }
    const nodes: ReactNode[] = [];
    bucket.forEach((entry, i) => {
      if (owner !== undefined && entry.n !== owner) { return; }
      try {
        nodes.push(
          createElement(
            'div',
            { key: `${entry.n}-${i}`, 'data-from': entry.n,
              ...(!unlocked.has(entry.n) ? { 'data-revealed': '1' } : {}) },
            entry.c.node(ctx, renderer(depth + 1)),
          ),
        );
      } catch {

      }
    });
    return createElement(Fragment, null, ...nodes);
  };

  return {
    declared,
    slot: renderer(0),
    one: (c: RenderContribution) => {
      try {
        return c.node(ctx, renderer(1));
      } catch {
        return null;
      }
    },
  };
};
