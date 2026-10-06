import { typedText, unlockWord, MISS, type SecretModule } from '../../shared/secret.ts';

const WORD = 'example';

export const secret: SecretModule = {
  name: 'An Example Secret',
  description: 'This contribution appears after the server accepts the example input.',
  unlockExplanation: 'You typed “example”.',
  unlockedBy: 'The server finds example in the lower-cased key input window, with no prerequisite or calendar restriction.',
  discoveryPages: ['*'],
  tags: ['example'],
  detect: ({ window }) => typedText(window).includes(WORD) ? unlockWord(WORD) : MISS,
  contributions: [{
    kind: 'render',
    slot: 'home.center',
    priority: 500,
    node: () => (
      <section className="example-note">
        <h2>An Example Secret</h2>
        <p>The server rendered this contribution for your session.</p>
        <p data-island="999999">The island is loading.</p>
      </section>
    ),
  }],
};
