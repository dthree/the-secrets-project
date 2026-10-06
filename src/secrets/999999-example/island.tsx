let previousTurns = 0;

export default function mount(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>('#turn-handle');
  const wheel = root.querySelector<HTMLElement>('.example-wheel');
  if (!button || !wheel) return;
  const turns = Number(root.dataset.turns);
  if (turns > previousTurns && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    wheel.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(120deg)' }],
      { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  previousTurns = turns;
  button.addEventListener('click', () => {
    dispatchEvent(new CustomEvent('secrets:report', { detail: { k: 'example.turn' } }));
  });
}
