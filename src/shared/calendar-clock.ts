export const validTimezoneOffset = (offset: unknown): offset is number =>
  typeof offset === 'number' && Number.isInteger(offset) && offset >= -840 && offset <= 720;

export function calendarDate(serverNow: Date, offset: unknown = 0): Date | null {
  return validTimezoneOffset(offset) ? new Date(serverNow.getTime() - offset * 60_000) : null;
}

export function weeksOf(now: Date): Array<Array<number | null>> {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: Array<number | null> = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
