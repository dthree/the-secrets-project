import { MISS, UNLOCK, type SecretModule } from '../../shared/secret.ts';

export const secret: SecretModule = {
  name: 'Pocket Sunrise',
  description: 'Apparently, this is where the morning comes from.',
  unlockExplanation: 'You turned the example machine’s handle three times.',
  unlockedBy: 'An admitted example.turn report brings the server-owned example.turns tally to at least three while the machine discovery is held.',
  discoveryPages: ['/'],
  requires: [999999],
  tags: ['example'],
  grants: { money: 5 },
  detect: ({ durable }) => (durable.tally['example.turns'] ?? 0) >= 3 ? UNLOCK : MISS,
  contributions: [{
    kind: 'render',
    slot: 'example.output',
    priority: 100,
    node: () => (
      <section className="example-sunrise" aria-labelledby="sunrise-title">
        <div className="example-landscape" aria-hidden="true"><span className="example-sun" /></div>
        <div className="example-sunrise-copy">
          <span className="example-eyebrow">Discovery 999998 · silver</span>
          <h2 id="sunrise-title">Pocket Sunrise</h2>
          <p>Apparently, this is where the morning comes from.</p>
          <p className="example-reward">You earned 5 demo tokens.</p>
        </div>
      </section>
    ),
  }],
};
