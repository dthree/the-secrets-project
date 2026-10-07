import type { ReactNode } from 'react';
import { isKey, type Channel, type Window } from './events.ts';
import type { WarmthKind } from './warmth.ts';

export type Hint = {

  n: number;
  text?: string;

  figure?: Figure;
};

export type Figure = {

  svg: string;

  code: string;
};

export type Medal = 'bronze' | 'silver' | 'gold' | 'platinum';

export type PublicManifest = {

  n: number;

  teaser: string;

  channels: Channel[];

  medal: Medal;

  hintsUnlocked?: Hint[];

  rootFigure?: Figure;

  rootHint?: string;
};

export type Durable = {

  resetAt?: number | null;

  visits: number;

  profileRef?: string;

  username: string | null;
  theme: 'dark' | 'light' | null;

  shapes: string[];

  solved: string[];

  money: number;

  inventory: Readonly<Record<string, number>>;

  tally: Readonly<Record<string, number>>;

  tallyAt: Readonly<Record<string, number>>;

  placed: Readonly<Record<string, number>>;

  vaulted: Readonly<Record<string, number>>;

  bought: Readonly<Record<string, number>>;

  hidden: readonly number[];

  carried: unknown;
};

export type DetectCtx = {
  window: Window;
  unlocked: ReadonlySet<number>;

  justUnlocked?: ReadonlySet<number>;
  now: Date;
  durable: Durable;

  tagged: Readonly<Record<string, readonly number[]>>;
};

export type Verdict =
  | { r: 'miss' }

  | { r: 'unlock'; keyLen?: number }

  | { r: 'warm'; kind: WarmthKind; text?: string; keyLen?: number };

export type Recurrence = {

  dow?: number;

  date?: number;

  dates?: readonly { month: number; date: number }[];
};

export type WarmthConfig = {

  gate?: WarmthKind;

  proximity?: {

    near: readonly string[] | Readonly<Record<string, string>>;
    text?: string;
  };

  time?: { text?: string };

  where?: { path: string | readonly string[] };
};

let typedTextMemo: WeakMap<Window, string> | undefined;

export function withTypedTextMemo<T>(work: () => T): T {
  const previous = typedTextMemo;
  typedTextMemo = new WeakMap();
  try { return work(); }
  finally { typedTextMemo = previous; }
}
export const typedText = (w: Window): string => {
  const cached = typedTextMemo?.get(w);
  if (cached !== undefined) return cached;
  const text = w.events.filter(isKey).map((e) => e.k).join('').toLowerCase();
  typedTextMemo?.set(w, text);
  return text;
};

export const warmWord = (word: string, text: string): Verdict =>
  ({ r: 'warm', kind: 'proximity', text, keyLen: word.length });

export const MISS: Verdict = { r: 'miss' };
export const UNLOCK: Verdict = { r: 'unlock' };

export const unlockWord = (word: string): Verdict => ({ r: 'unlock', keyLen: word.length });

export const unlockPhrase = (w: Window, phrase: string): Verdict => {
  const want = phrase.replace(/[^a-z0-9]/g, '');
  const raw = typedText(w);

  const at: number[] = [];
  let compact = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) { at.push(i); compact += ch; }
  }
  const found = compact.indexOf(want);
  if (found < 0) { return MISS; }
  return { r: 'unlock', keyLen: at[found + want.length - 1] - at[found] + 1 };
};

export type SlotCtx = {

  justUnlocked?: ReadonlySet<number>;

  prepared?: ReadonlyMap<number, unknown>;
  publicVisitor?: boolean;

  arrival?: { name?: string; text: string };

  presence?: import('./presence.ts').PresenceView;

  durable: Durable;

  boards: unknown[];

  replayBoards?: string[];

  farm: Array<{ n: number; name: string; hidden: boolean }>;
  mine: number;
  total: number;

  signedIn: boolean;

  needsUsername: boolean;

  username: string | null;

  accountUrl: string | null;

  profileRef?: string;

  email: string | null;

  path: string;

  discovered: number;

  neverUnlocked: number;
  unlocked: ReadonlySet<number>;
};

export type SlotRenderer = {
  (name: string, owner?: number): ReactNode;

  entries?: (name: string) => ReadonlyArray<{
    n: number; priority: number; held: boolean; css?: string | null;
  }>;
};

export type RenderContribution = {
  kind: 'render';
  slot: string;
  priority: number;
  node: (c: SlotCtx, slot: SlotRenderer) => ReactNode;
};

export type SlotMap = Map<string, Array<{ priority: number; n: number; c: RenderContribution }>>;

export type Contribution =
  | RenderContribution

  | { kind: 'transform'; priority: number; apply: (m: SlotMap, c: SlotCtx) => SlotMap };

export type Model = {

  declared: Set<string>;

  slot: SlotRenderer;

  one: (c: RenderContribution) => ReactNode;
};

export type Credit = {

  used: string;

  title: string;
  author: string;

  url?: string;
} & ({

  category: 'niches';
  licence?: never;
  licenceUrl?: never;
  required: false;
} | {

  category?: 'audio' | 'resources';
  url: string;
  licence: string;
  licenceUrl: string;

  required: boolean;
});

export type SecretProgression = {
  branch: string;
  payoff: 1 | 2 | 3 | 4 | 5;

  effort?: [number, number];

  branchEffort?: [number, number];
  branchNote?: string;

  expected?: [number, number, number];

  wait?: string;
  note?: string;
  status?: 'blocked';
  cue?: { at: number; label: string; kind: 'invitation' | 'hard'; needs?: number[] };
  links?: Array<{ from: number; kind: 'functional' | 'automatic' | 'invitation' | 'example'; note: string }>;
};

export type ProfileAppearance = {
  css: string;
  theme?: 'dark' | 'light';

  script?: string;
  card?: {
    background?: string;
    ink?: string;
    scale?: number;
    wallpaper?: { image: string; size: string; intensity: number; accent?: string; accentColor?: string };
  };
};

export type ShareArtifact = {

  poster: string;

  dare: string;

  note: string;

  credit?: string;

  layout?: 'scene' | 'hero';

  heroHeight?: number;

  wallpaper?: string;
};

export type SecretModule = {

  interactionFeedback?: readonly {
    id: string;
    fixture: number;
    path: string;
    clickCode: string;
    after: number;
    text: string;
  }[];

  developmentOnly?: boolean;

  creatorsOnly?: boolean;

  pages?: readonly { path: string; title: string; game?: boolean;

    icon?: typeof import('@hugeicons/core-free-icons').Home01Icon;
    search?: { title: string; description: string };
    canonicalPath?: string;

    navigation?: false;
  }[];

  publicVisitorMode?: 'play' | 'view' | 'trail' | 'site';
  publicVisitorPaths?: readonly string[];

  publicVisitorRoutes?: { read?: readonly string[]; play?: readonly string[] };
  progression?: SecretProgression;

  reveal?: {
    detect(ctx: DetectCtx): number | null;
    contributions: RenderContribution[];
  };

  name: string;
  description: string;

  unlockExplanation: string;

  unlockExplanationTouch?: string;

  unlocks?: Array<{
    title: string;
    description: string;
    icon: typeof import('@hugeicons/core-free-icons').Home01Icon;
  }>;

  unlockedBy?: string;

  discoveryPages?: readonly string[];

  requires?: number[];

  recurs?: Recurrence;

  warmth?: WarmthConfig;
  detect(ctx: DetectCtx): Verdict;

  declaresSlots?: string[];

  share?: ShareArtifact;

  contributions?: Contribution[];

  tags?: string[];

  label?: string;

  hasIsland?: boolean;

  stylesEnabled?: boolean;

  chromeEdge?: 'fade' | 'rule';

  gameMode?: boolean | readonly string[];

  publicExcept?: readonly string[];

  consumes?: { item: string };

  uses?: { item: string };

  grants?: { money?: number; item?: string };

  navigateTo?: string;

  arrivalUnlocks?: boolean;

  pasteable?: boolean;

  credits?: Credit[];
};
