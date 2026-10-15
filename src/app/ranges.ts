import type { WrappedPreset } from './api';

/** The longest range the warehouse wraps is 3,660 days; one less leaves room for a daylight-saving hour. */
export const MAX_RANGE_DAYS = 3659;

const DAY_MS = 86_400_000;

/** A calendar date 'YYYY-MM-DD' moved by whole days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, counting both. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * The latest day the warehouse will certainly wrap. It summarizes a range
 * only once it has ended in the warehouse's own timezone, which neither this
 * browser nor /api/wrapped/ranges knows. So this is yesterday in the last
 * timezone on Earth to reach today (UTC−12): wherever the warehouse is, that
 * day is over.
 */
export function lastClosedDay(now = new Date()): string {
  const behind = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return addDays(behind, -1);
}

export interface RangeOption {
  label: string;
  from: string;
  to: string;
}

/**
 * The chips to offer. The warehouse's presets always: a read token computes
 * those on request. Rolling ranges and all time only when the token might be
 * able to compute them; a read token gets a 403 for any range that isn't a
 * preset and hasn't been computed, and these move daily, so never have been.
 */
export function rangeOptions(presets: readonly WrappedPreset[] | null, access: 'read' | 'unknown', now = new Date()): RangeOption[] {
  const options: RangeOption[] = (presets ?? []).map(({ label, from, to }) => ({ label, from, to }));
  if (access === 'read') return options;
  const to = lastClosedDay(now);
  options.push({ label: 'Last 90 days', from: addDays(to, -89), to }, { label: 'Last 30 days', from: addDays(to, -29), to });
  const oldest = presets?.at(-1);
  if (oldest && oldest.from <= to) {
    const capped = daysBetween(oldest.from, to) > MAX_RANGE_DAYS;
    options.push({ label: capped ? 'Last 10 years' : 'All time', from: capped ? addDays(to, 1 - MAX_RANGE_DAYS) : oldest.from, to });
  }
  return options;
}

/** Why the warehouse would refuse a custom range, or null if it should take it. */
export function rangeProblem(from: string, to: string, now = new Date()): string | null {
  if (to < from) return 'The end date is before the start date.';
  if (to > lastClosedDay(now)) return 'A range can only end once that day is over everywhere: pick an earlier end date.';
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return `A range can be at most ${MAX_RANGE_DAYS.toLocaleString('en-GB')} days long.`;
  return null;
}
