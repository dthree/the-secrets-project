export type PresenceView = { total: number; page: number };

export const PAGE_BREAKDOWN_ABOVE = 10;

export const presenceDisplay = ({ total }: PresenceView) => {
  const n = Math.max(1, total);
  return {
    count: n.toLocaleString('en-US'),
    description: `${n === 1 ? ' person' : ' people'} on this site`,
  };
};
