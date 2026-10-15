import { describe, expect, it } from 'vitest';
import type { WrappedPreset } from './api';
import { addDays, daysBetween, lastClosedDay, MAX_RANGE_DAYS, rangeOptions, rangeProblem } from './ranges';

const presets: WrappedPreset[] = [
  { from: '2026-01-01', to: '2026-10-11', label: '2026 so far', kind: 'year_to_date', computed: true },
  { from: '2025-01-01', to: '2025-12-31', label: '2025', kind: 'year', computed: false },
];

describe('day arithmetic', () => {
  it('moves across months, years and leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2025-01-01', '2025-12-31')).toBe(365);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(1);
  });
});

describe('lastClosedDay', () => {
  it('is yesterday where it is earliest on Earth, whatever this browser thinks', () => {
    // Just after midnight in Kiritimati (UTC+14) on the 16th, it is still the 14th in UTC−12.
    expect(lastClosedDay(new Date('2026-10-15T10:30:00Z'))).toBe('2026-10-13');
    // Late on the 15th in UTC, it is the 15th in UTC−12 too.
    expect(lastClosedDay(new Date('2026-10-15T23:00:00Z'))).toBe('2026-10-14');
  });

  it('is before today in every timezone', () => {
    const now = new Date('2026-10-15T11:59:00Z');
    for (const timeZone of ['Pacific/Kiritimati', 'Asia/Singapore', 'Europe/London', 'America/Los_Angeles', 'Etc/GMT+12']) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
      expect(lastClosedDay(now) < today, timeZone).toBe(true);
    }
  });
});

describe('rangeOptions', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  it('offers a read token only the presets, computed or not, since the warehouse computes presets on request', () => {
    expect(rangeOptions(presets, 'read', now).map((o) => o.label)).toEqual(['2026 so far', '2025']);
  });

  it('adds rolling ranges and all time when the token may compute them', () => {
    expect(rangeOptions(presets, 'unknown', now)).toEqual([
      { label: '2026 so far', from: '2026-01-01', to: '2026-10-11' },
      { label: '2025', from: '2025-01-01', to: '2025-12-31' },
      { label: 'Last 90 days', from: '2026-07-17', to: '2026-10-14' },
      { label: 'Last 30 days', from: '2026-09-15', to: '2026-10-14' },
      { label: 'All time', from: '2025-01-01', to: '2026-10-14' },
    ]);
  });

  it('caps all time at the longest range the warehouse wraps', () => {
    const old: WrappedPreset[] = [{ from: '2010-01-01', to: '2010-12-31', label: '2010', kind: 'year', computed: true }];
    const all = rangeOptions(old, 'unknown', now).at(-1)!;
    expect(all.label).toBe('Last 10 years');
    expect(daysBetween(all.from, all.to)).toBe(MAX_RANGE_DAYS);
    expect(rangeProblem(all.from, all.to, now)).toBeNull();
  });

  it('copes with presets not loaded yet', () => {
    expect(rangeOptions(null, 'read', now)).toEqual([]);
    expect(rangeOptions(null, 'unknown', now).map((o) => o.label)).toEqual(['Last 90 days', 'Last 30 days']);
  });
});

describe('rangeProblem', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it('accepts a closed range', () => expect(rangeProblem('2026-01-01', '2026-10-14', now)).toBeNull());
  it('refuses one that has not ended everywhere', () => expect(rangeProblem('2026-01-01', '2026-10-15', now)).toMatch(/earlier end date/));
  it('refuses one backwards', () => expect(rangeProblem('2026-02-01', '2026-01-01', now)).toMatch(/before the start/));
  it('refuses one too long', () => expect(rangeProblem(addDays('2026-10-14', -MAX_RANGE_DAYS), '2026-10-14', now)).toMatch(/at most 3,659 days/));
});
