export type Descriptor = {
  tag: string;
  id: string | null;
  cls: string[];
  data: Record<string, string>;
};

export type Ev =

  | { t: 'p'; ts: number; x: number; y: number; h?: 1; s?: number }
  | { t: 'k'; ts: number; k: string }

  | { t: 'c'; ts: number; x: number; y: number; d: Descriptor; b: number }

  | { t: 'u'; ts: number; ms: number }

  | { t: 'v'; ts: number; w: number; h: number }

  | { t: 'w'; ts: number; dy: number }

  | { t: 'x'; ts: number; k: string };

export type Channel =
  | 'pointer' | 'key' | 'click' | 'viewport' | 'wheel' | 'time' | 'report';

export const CHANNEL_OF: Record<Ev['t'], Channel> = {
  p: 'pointer',
  k: 'key',
  c: 'click',
  u: 'click',
  v: 'viewport',
  w: 'wheel',
  x: 'report',
};

export const isClick = (e: Ev): e is Extract<Ev, { t: 'c' }> => e.t === 'c';
export const isKey = (e: Ev): e is Extract<Ev, { t: 'k' }> => e.t === 'k';
export const isPointer = (e: Ev): e is Extract<Ev, { t: 'p' }> => e.t === 'p';
export const isReport = (e: Ev): e is Extract<Ev, { t: 'x' }> => e.t === 'x';

export type Window = {

  timezoneOffset?: number;
  events: Ev[];

  keyAnswered?: number;

  ua: string;

  vw: number;
  vh: number;

  idle: number;

  path: string;

  params?: string[];

  moved?: number;

  scrolled: number;
  below: number;

  t0: number;

  broke?: number;
};

export type BatchRequest = {

  feedbackAck?: string[];

  noticeReceipt?: string;

  probe?: import('./probe.ts').ProbeSample;

  pr?: 1;

  cu?: number;

  cs?: import('./cursors.ts').CursorSample | null;

  build?: string;
  window: Window;

  token?: string;

  display?: string;

  ack?: number[];

  wantHint?: 1;
};

export type FeedbackState = { at: number; progress: Record<string, [count: number, seen: number, offered: number]> };

export type Reveal = {

  revealed?: true;

  n: number;

  slot: string;
  html: string;

  island?: string;
};

import type { Medal } from './secret.ts';
import type { WarmthKind } from './warmth.ts';

export type SavedHint = { id: string; text: string; medal: Medal; at: number };
export type DiscoveryHistory = { discoveries: DiscoveryRow[]; hints: SavedHint[]; hasHints: boolean };

export type DiscoveryRow = {
  n: number; name: string; description: string; medal: Medal; unread: boolean; at: number;
};

export type Notice = {
  presentation?: 'standard' | 'significant';

  at?: number;
  n: number;
  name: string;
  description: string;

  unlockExplanation: string;
  unlockExplanationTouch?: string;
  unlocks: Array<{ title: string; description: string; icon: string }>;

  medal: Medal;

  pct: number;

  channels: Channel[];

  keyLen?: number;

  pos?: number;

  explainNumber?: boolean;

  card?: boolean;
};

export type Early = {

  debug?: { fields: Array<{ label: string; value: string }> };
  medal: Medal;

  keyLen?: number;
  text: string;

  kind: WarmthKind;

  n?: number;
};

export type BatchResponse = {
  display?: string;
  feedback?: { id: string; title?: string; text: string };
  feedbackAck?: string[];

  probe?: import('./probe.ts').ProbeReply;
  presence?: import('./presence.ts').PresenceView;

  cursors?: import('./cursors.ts').CursorWire[];

  pr?: boolean;

  update?: string;

  unreadable?: true;

  reload?: boolean;

  reveals: Reveal[];

  notices: Notice[];

  earned?: number[];

  early?: Early[];

  hintsChanged?: boolean;

  pending?: Notice[];

  noticeReceipt?: string;

  token?: string;

  hint?: { text: string } | { svg: string };

  go?: string;

  goLabel?: string;

  shapesHtml?: string;

  sheets?: Array<{ name: string; css: string }>;

  paid?: number;

  swaps?: Array<{ sel: string; html: string; scroll?: 'start' }>;

  counterHtml: string;
  mineHtml: string;
  dismissArrival?: boolean;

  mine: number;
  discovered: number;
  neverUnlocked: number;
  total: number;
};

export const SESSION_HEADER_BUDGET = 3 * 1024;
export const sessionTransport = (token: string, display: string) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['x-secrets-token'] = token;
  const inHeader = !!display && token.length + display.length + 40 <= SESSION_HEADER_BUDGET;
  if (inHeader) headers['x-secrets-display'] = display;
  return { headers, display: !inHeader && display ? display : undefined };
};
