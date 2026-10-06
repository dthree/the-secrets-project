import { typedText, unlockWord, MISS, type SecretModule } from '../../shared/secret.ts';

const WORD = 'example';

export const secret: SecretModule = {
  name: 'An Example Machine',
  description: 'Nobody left a manual, but the handle looks promising.',
  unlockExplanation: 'You typed “example”.',
  unlockedBy: 'The server finds example in the lower-cased key input window, with no prerequisite or calendar restriction.',
  discoveryPages: ['*'],
  tags: ['example'],
  warmth: { proximity: { near: ['demo', 'sample'], text: 'That is close to another word for demonstration.' } },
  declaresSlots: ['example.output'],
  detect: ({ window }) => typedText(window).includes(WORD) ? unlockWord(WORD) : MISS,
  contributions: [{
    kind: 'render',
    slot: 'home.center',
    priority: 500,
    node: ({ durable }, slot) => {
      const turns = durable.tally['example.turns'] ?? 0;
      return (
        <section className="example-machine" aria-labelledby="machine-title">
          <div className="example-machine-heading">
            <span className="example-eyebrow">Discovery 999999 · bronze</span>
            <h2 id="machine-title">An Example Machine</h2>
            <p>Nobody left a manual, but the handle looks promising.</p>
          </div>
          <div className="example-mechanism" data-island="999999" data-turns={turns}>
            <div className="example-wheel" aria-hidden="true"><span /></div>
            <div className="example-controls">
              <button id="turn-handle" type="button" disabled={turns >= 1000}>Turn the handle</button>
              <p className="example-counter">{turns} {turns === 1 ? 'turn' : 'turns'} remembered</p>
            </div>
          </div>
          <div className="example-output" data-slot="example.output">{slot('example.output')}</div>
        </section>
      );
    },
  }],
};
