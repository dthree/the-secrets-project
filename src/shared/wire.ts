import type { Descriptor, Ev, Window } from './events.ts';

export const WIRE_V = 2;

export const PARAMS_MAX = 8;
export const PARAM_LEN = 32;

export type Wire = {
  feedbackAck?: string[];
  noticeReceipt?: string;

  tz?: number;
  pr?: 1;
  v: typeof WIRE_V;

  vw: number;
  vh: number;
  i: number;
  p: string;

  q?: string[];
  t0: number;

  m: number;

  sy: number;
  sb: number;

  b?: number;

  k?: string;

  ka?: number;

  kt?: number[];

  hp?: number[];

  hs?: number[][];

  w?: number[];

  c?: Array<[number, number, number, number, number]>;
  d?: string[];

  u?: number[];

  e?: Ev[];
};

const isP = (e: Ev): e is Ev & { t: 'p' } => e.t === 'p';

export const travelOf = (samples: Array<{ x: number; y: number }>): number => {
  let d = 0;
  for (let i = 1; i < samples.length; i++) {
    d += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  return d;
};

export const encode = (events: Ev[], state: Omit<Window, 'events' | 'ua'>): Wire => {
  const keys: Array<Ev & { t: 'k' }> = [];
  const held: Array<Ev & { t: 'p' }> = [];
  const unheld: Array<Ev & { t: 'p' }> = [];
  const wheels: Array<Ev & { t: 'w' }> = [];
  const clicks: Array<Ev & { t: 'c' }> = [];
  const presses: Array<Ev & { t: 'u' }> = [];
  const rest: Ev[] = [];

  for (const e of events) {
    if (e.t === 'k') { keys.push(e); continue; }
    if (isP(e)) { (e.h ? held : unheld).push(e); continue; }
    if (e.t === 'w') { wheels.push(e); continue; }
    if (e.t === 'c') { clicks.push(e); continue; }
    if (e.t === 'u') { presses.push(e); continue; }
    rest.push(e);
  }

  const out: Wire = {
    v: WIRE_V,
    vw: state.vw, vh: state.vh, i: state.idle, p: state.path,
    q: state.params?.length ? state.params : undefined,
    t0: state.t0,
    tz: state.timezoneOffset,

    m: Math.round(state.moved ?? travelOf(unheld)),
    sy: Math.round(state.scrolled),
    sb: Math.round(state.below),
    b: state.broke || undefined,
  };

  if (keys.length) {
    out.ka = state.keyAnswered || undefined;
    out.k = keys.map((e) => (e.k === '' ? '\n' : e.k)).join('');
    out.kt = [keys[0].ts];
    for (let i = 1; i < keys.length; i++) { out.kt.push(keys[i].ts - keys[i - 1].ts); }
  }

  if (held.length) {

    const strokes: Array<Array<Ev & { t: 'p' }>> = [];
    let last: number | undefined;
    for (const e of held) {
      if (!strokes.length || (e.s !== undefined && e.s !== last)) { strokes.push([]); }
      strokes[strokes.length - 1].push(e);
      last = e.s;
    }
    out.hs = strokes.map((st) => {
      const a = [st[0].ts, st[0].x, st[0].y];
      for (let i = 1; i < st.length; i++) {
        a.push(st[i].ts - st[i - 1].ts, st[i].x - st[i - 1].x, st[i].y - st[i - 1].y);
      }
      return a;
    });
  }

  if (wheels.length) {
    const w = [wheels[0].ts, wheels[0].dy];
    for (let i = 1; i < wheels.length; i++) {
      w.push(wheels[i].ts - wheels[i - 1].ts, wheels[i].dy);
    }
    out.w = w;
  }

  if (clicks.length) {
    const d: string[] = [];
    out.c = clicks.map((e) => {
      const key = JSON.stringify(e.d);
      let i = d.indexOf(key);
      if (i < 0) { i = d.push(key) - 1; }
      return [e.ts, e.x, e.y, e.b, i] as [number, number, number, number, number];
    });
    out.d = d;
  }

  if (presses.length) {
    out.u = [presses[0].ts, presses[0].ms];
    for (let i = 1; i < presses.length; i++) {
      out.u.push(presses[i].ts - presses[i - 1].ts, presses[i].ms);
    }
  }

  const latest = unheld.at(-1);
  const sparse = latest ? [...rest, latest] : rest;
  if (sparse.length) { out.e = sparse; }

  return out;
};

export const decode = (w: Wire, ua: string): Window => {
  const events: Ev[] = [];

  if (w.k && w.kt?.length) {
    let ts = w.kt[0];
    for (let i = 0; i < w.k.length; i++) {
      if (i > 0) { ts += w.kt[i] ?? 0; }
      const ch = w.k[i];
      events.push({ t: 'k', ts, k: ch === '\n' ? '' : ch });
    }
  }

  const unpack = (run: number[], s: number) => {
    if (!run || run.length < 3) { return; }
    let ts = run[0];
    let x = run[1];
    let y = run[2];
    events.push({ t: 'p', ts, x, y, h: 1, s });
    for (let i = 3; i + 2 < run.length; i += 3) {
      ts += run[i];
      x += run[i + 1];
      y += run[i + 2];
      events.push({ t: 'p', ts, x, y, h: 1, s });
    }
  };

  if (w.hs?.length) {
    w.hs.forEach((run, i) => unpack(run, i));
  } else if (w.hp) {
    unpack(w.hp, 0);
  }

  if (w.w && w.w.length >= 2) {
    let ts = w.w[0];
    events.push({ t: 'w', ts, dy: w.w[1] });
    for (let i = 2; i + 1 < w.w.length + 1 && i + 1 <= w.w.length; i += 2) {
      ts += w.w[i];
      events.push({ t: 'w', ts, dy: w.w[i + 1] });
    }
  }

  if (w.c?.length) {
    for (const [ts, x, y, b, di] of w.c) {
      let d: Descriptor = { tag: 'none', id: null, cls: [], data: {} };
      try { d = JSON.parse(w.d?.[di] ?? '') as Descriptor; } catch {                          }
      events.push({ t: 'c', ts, x, y, b, d });
    }
  }

  if (w.e?.length) { events.push(...w.e); }

  if (w.u?.length) {
    let ts = 0;
    for (let i = 0; i < w.u.length; i += 2) {
      ts += w.u[i];
      events.push({ t: 'u', ts, ms: w.u[i + 1] });
    }
  }

  events.sort((a, b) => a.ts - b.ts);

  const num = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
  const str = (x: unknown, fallback: string) => (typeof x === 'string' ? x : fallback);

  return {
    events,
    keyAnswered: Number.isInteger(w.ka) && w.ka! >= 0 && w.ka! <= (w.k?.length ?? 0) ? w.ka : undefined,
    ua,

    timezoneOffset: w.tz,
    vw: num(w.vw, 0),
    vh: num(w.vh, 0),
    idle: num(w.i, 0),
    path: str(w.p, '/'),

    params: Array.isArray(w.q)
      ? w.q.filter((name): name is string => typeof name === 'string').slice(0, PARAMS_MAX).map(name => name.slice(0, PARAM_LEN))
      : [],
    t0: num(w.t0, Date.now()),
    moved: num(w.m, 0),
    scrolled: num(w.sy, 0),
    below: num(w.sb, 0),
    broke: num(w.b, 0) || undefined,
  };
};
