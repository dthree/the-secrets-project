import type { Window } from '../../shared/events.ts';

export function typingFeedback(window: Window) {
  const answered = Number.isSafeInteger(window.keyAnswered) && window.keyAnswered! > 0 ? window.keyAnswered! : 0;
  if (!answered) return (_matches: (part: Window) => boolean) => true;
  let index = 0;
  const prefix: Window = { ...window, events: window.events.filter(e => e.t !== 'k' || ++index <= answered) };
  index = 0;
  const suffix: Window = { ...window, events: window.events.filter(e => e.t !== 'k' || ++index > answered) };
  const hasFreshKeys = suffix.events.some(e => e.t === 'k');
  return (matches: (part: Window) => boolean) => hasFreshKeys && (matches(suffix) || !matches(prefix));
}
