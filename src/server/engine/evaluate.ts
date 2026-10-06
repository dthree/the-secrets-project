import { calendarDate } from '../../shared/calendar-clock.ts';
import { isRevealed } from '../../shared/revealed.ts';
import { CHANNEL_OF, type Window } from '../../shared/events.ts';
import type { Channel } from '../../shared/events.ts';
import type { Secret } from './registry.ts';
import { typedText, type Durable, type Recurrence, type WarmthConfig } from '../../shared/secret.ts';
import type { WarmthKind } from '../../shared/warmth.ts';
import { typingFeedback } from './typing-feedback.ts';

export type Outcome = {
  unlocked: Array<{ n: number; keyLen?: number }>;

  early: Array<{ n: number; keyLen?: number; kind: WarmthKind; text?: string }>;
};

const placeMet = (w: WarmthConfig['where'], path: string | undefined): boolean => {
  if (!w) { return true; }
  const allowed = typeof w.path === 'string' ? [w.path] : w.path;
  return allowed.includes(path ?? '/');
};

const recurrenceMet = (r: Recurrence | undefined, now: Date | null, ignore = false): boolean => {
  if (r === undefined || ignore) { return true; }
  if (!now) return false;

  if (r.dow !== undefined && now.getUTCDay() !== r.dow) { return false; }
  if (r.date !== undefined && now.getUTCDate() !== r.date) { return false; }
  if (r.dates && !r.dates.some(d => d.month === now.getUTCMonth() + 1 && d.date === now.getUTCDate())) { return false; }
  return true;
};

const channelsInWindow = (w: Window): Set<Channel> => {
  const s = new Set<Channel>(['time']);
  for (const e of w.events) { s.add(CHANNEL_OF[e.t]); }
  return s;
};

export const evaluate = (
  secrets: Secret[],
  window: Window,
  unlocked: ReadonlySet<number>,
  now: Date,
  durable: Durable,
  tagged: Readonly<Record<string, readonly number[]>>,

  opts: { ignoreRecurrence?: boolean; available?: ReadonlySet<number>; justUnlocked?: ReadonlySet<number> } = {},
): Outcome => {
  const access = opts.available ?? unlocked;
  const live = channelsInWindow(window);
  const out: Outcome = { unlocked: [], early: [] };
  const freshTyping = typingFeedback(window);
  let localDate: Date | null | undefined;

  for (const { manifest, module } of secrets) {
    if (unlocked.has(manifest.n)) {

      if (live.has('key') && manifest.channels.includes('key')) {
        try {
          const v = module.detect({ window, unlocked: access, justUnlocked: opts.justUnlocked, now, durable, tagged });
          if (v.r === 'unlock' && v.keyLen && freshTyping(part => {
            const match = module.detect({ window: part, unlocked: access, justUnlocked: opts.justUnlocked, now, durable, tagged });
            return match.r === 'unlock' && match.keyLen === v.keyLen;
          })) {
            out.early.push({ n: manifest.n, keyLen: v.keyLen, kind: 'held' });
          }
        } catch {                                                   }
      }
      continue;
    }
    if (!manifest.channels.some((c) => live.has(c))) { continue; }

    let verdict;
    try {
      verdict = module.detect({ window, unlocked: access, justUnlocked: opts.justUnlocked, now, durable, tagged });
    } catch {
      continue;
    }

    const cfg = module.warmth;
    const equipped = !(module.requires ?? []).some((r) => !access.has(r));
    const inSeason = !module.recurs || !!opts.ignoreRecurrence || recurrenceMet(module.recurs,
      localDate === undefined ? (localDate = calendarDate(now, window.timezoneOffset)) : localDate);

    const inPlace = placeMet(cfg?.where, window.path);

    if (verdict.r === 'miss') {

      const near = cfg?.proximity;
      if (!near || !inSeason || !equipped || !inPlace) { continue; }
      const typed = typedText(window);

      const map: Readonly<Record<string, string>> | null =
        Array.isArray(near.near) ? null : (near.near as Readonly<Record<string, string>>);
      const words: readonly string[] = map ? Object.keys(map) : (near.near as readonly string[]);
      const hit = words.find((w) => {
        const matches = (text: string) => text.endsWith(w) || new RegExp(`${w}[^a-z]`).test(text);
        return matches(typed) && freshTyping(part => matches(typedText(part)));
      });
      if (hit === undefined) { continue; }

      const own = map ? map[hit] : undefined;
      out.early.push({
        n: manifest.n, keyLen: hit.length, kind: 'proximity', text: own || near.text,
      });
      continue;
    }

    const freshVerdict = () => !verdict.keyLen || freshTyping(part => {
      try {
        const match = module.detect({ window: part, unlocked: access, justUnlocked: opts.justUnlocked, now, durable, tagged });
        return match.r === verdict.r && match.keyLen === verdict.keyLen
          && (match.r !== 'warm' || verdict.r !== 'warm' || (match.kind === verdict.kind && match.text === verdict.text));
      } catch { return false; }
    });

    if (verdict.r === 'warm') {
      if (!inPlace || !equipped || !inSeason || !freshVerdict()) { continue; }
      out.early.push({
        n: manifest.n, keyLen: verdict.keyLen, kind: verdict.kind, text: verdict.text,
      });
      continue;
    }

    if (!equipped) {
      if (!freshVerdict()) { continue; }
      out.early.push({
        n: manifest.n, keyLen: verdict.keyLen, kind: cfg?.gate ?? 'prerequisite',
      });
      continue;
    }

    if (!inSeason) {
      if (!freshVerdict()) { continue; }
      out.early.push({
        n: manifest.n, keyLen: verdict.keyLen, kind: 'time', text: cfg?.time?.text,
      });
      continue;
    }

    out.unlocked.push({ n: manifest.n, keyLen: verdict.keyLen });
  }

  return out;
};

export const evaluateReveals = (
  secrets: Secret[], window: Window, unlocked: ReadonlySet<number>, now: Date,
  durable: Durable, tagged: Readonly<Record<string, readonly number[]>>,
  opts: { ignoreRecurrence?: boolean } = {},
): Array<{ n: number; at: number }> => {
  const channels = channelsInWindow(window);
  let localDate: Date | null | undefined;
  const out: Array<{ n: number; at: number }> = [];
  for (const { manifest, module } of secrets) {
    if (!module.reveal || unlocked.has(manifest.n) || isRevealed(durable, manifest.n)
      || !manifest.channels.some(c => channels.has(c))
      || module.requires?.some(n => !unlocked.has(n))
      || (module.recurs && !opts.ignoreRecurrence && !recurrenceMet(module.recurs,
        localDate === undefined ? (localDate = calendarDate(now, window.timezoneOffset)) : localDate))) { continue; }
    try {
      const at = module.reveal.detect({ window, unlocked, now, durable, tagged });
      if (at !== null && Number.isFinite(at) && at > 0 && at <= now.getTime()) {
        out.push({ n: manifest.n, at });
      }
    } catch {                                                  }
  }
  return out;
};
