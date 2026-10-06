import { typedText, unlockWord, MISS, type SecretModule } from '../../shared/secret.ts';

const WORD = 'example';

export const secret: SecretModule = {
  name: 'An example secret',
  description: 'This contribution appears after the server accepts the example input.',
  unlockExplanation: 'You typed the example word.',
  detect: ({ window }) => typedText(window).includes(WORD) ? unlockWord(WORD) : MISS,
  contributions: [{
    kind: 'render',
    slot: 'home.center',
    priority: 500,
    node: () => (
      <section className="example-note">
        <h2>An example secret</h2>
        <p>The server rendered this contribution for your session.</p>
        <p data-island="999999">The island is loading.</p>
      </section>
    ),
  }],
};
