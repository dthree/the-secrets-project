export type CursorAnchor = 'center' | 'top';
export type CursorMode = CursorAnchor | 'surface';
export type CursorPoint = { x: number; y: number; key?: string };

export type CursorSurface = {
  path: string;
  host: HTMLElement;
  shape?: 'cell';
  selection?(): CursorPoint | null;
  toShared(x: number, y: number): CursorPoint | null;
  fromShared(x: number, y: number, key?: string): { x: number; y: number; width?: number; height?: number } | null;
};

export type CursorSample = [x: number, y: number, timestamp: number, age: number, key?: string];
export const CURSOR_SURFACE_BOUND = 1_000_000;

export const CURSOR_HEARTBEAT_MS = 8_000;

export const CURSOR_LEASE_MS = 24_000;

export const CURSORS_FROM = 3;

export const CURSORS_SHOWN = 15;

export const toFrame = (anchor: CursorAnchor, x: number, y: number, vw: number, vh: number, scrolled: number) => ({
  x: Math.round(x - vw / 2),
  y: Math.round(anchor === 'center' ? y - vh / 2 : y + scrolled),
});

export const fromFrame = (anchor: CursorAnchor, x: number, y: number, vw: number, vh: number, scrolled: number) => ({
  x: x + vw / 2,
  y: anchor === 'center' ? y + vh / 2 : y - scrolled,
});

export type CursorWire = [id: string, label: string, points: number[], clicks?: number[], username?: string | null, peer?: string,
  key?: string,

];
