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

/**
 * Rolling ranges to offer beside the warehouse's own presets. Each ends
 * yesterday, because the warehouse only summarizes ranges that have ended,
 * and needs the admin token, because a read token computes presets only.
 */
export function rollingPresets(now = new Date()): Preset[] {
  const yesterday = daysAgo(1, now);
  return [
    { label: 'Last 90 days', from: daysAgo(90, now), to: yesterday },
    { label: 'Last 30 days', from: daysAgo(30, now), to: yesterday },
  ];
}
