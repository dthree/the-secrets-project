import type { Window } from '../../shared/events.ts';

export function typingFeedback(window: Window) {
  const answered = Number.isSafeInteger(window.keyAnswered) && window.keyAnswered! > 0 ? window.keyAnswered! : 0;
  if (!answered) return (_matches: (part: Window) => boolean) => true;
  let parts: { prefix: Window; suffix: Window; hasFreshKeys: boolean } | undefined;
  return (matches: (part: Window) => boolean) => {

    if (!parts) {
      let index = 0;
      const prefix: Window = { ...window, events: [] };
      const suffix: Window = { ...window, events: [] };
      let hasFreshKeys = false;
      for (const event of window.events) {
        if (event.t !== 'k') { prefix.events.push(event); suffix.events.push(event); }
        else if (++index <= answered) prefix.events.push(event);
        else { suffix.events.push(event); hasFreshKeys = true; }
      }
      parts = { prefix, suffix, hasFreshKeys };
    }
    return parts.hasFreshKeys && (matches(parts.suffix) || !matches(parts.prefix));
  };
}
