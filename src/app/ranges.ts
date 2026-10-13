/** Local calendar dates as 'YYYY-MM-DD'. */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

export interface Preset {
  label: string;
  from: string;
  to: string;
}

/** The warehouse's history starts in July 2020. */
const FIRST_YEAR = 2020;

/**
 * Ranges worth one tap. Every one ends yesterday at the latest, because the
 * warehouse only summarizes ranges that have ended.
 */
export function presets(now = new Date()): Preset[] {
  const year = now.getFullYear();
  const yesterday = daysAgo(1, now);
  const out: Preset[] = [];
  if (yesterday >= `${year}-01-01`) out.push({ label: `${year} so far`, from: `${year}-01-01`, to: yesterday });
  for (let y = year - 1; y >= FIRST_YEAR; y--) out.push({ label: String(y), from: `${y}-01-01`, to: `${y}-12-31` });
  out.push({ label: 'Last 90 days', from: daysAgo(90, now), to: yesterday });
  out.push({ label: 'Last 30 days', from: daysAgo(30, now), to: yesterday });
  out.push({ label: 'All time', from: `${FIRST_YEAR}-07-01`, to: yesterday });
  return out;
}
