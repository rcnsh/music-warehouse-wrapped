const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const number = (n: number) => n.toLocaleString('en-GB');

export const percent = (share: number) => `${Math.round(share * 100)}%`;

/** 'YYYY-MM' → 'May'. */
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

/** 'YYYY-MM-DD' → '22 July'. */
export function dayName(day: string, withYear = false): string {
  const label = `${Number(day.slice(8, 10))} ${monthName(day)}`;
  return withYear ? `${label} ${day.slice(0, 4)}` : label;
}

/**
 * What the story calls the range: a bare year for a calendar year, otherwise
 * the two ends. Spotify only ever does years; this does any closed range.
 */
export function rangeTitle(range: { from: string; to: string }): { big: string; small: string | null } {
  const [fy, fm, fd] = range.from.split('-');
  const [ty, tm, td] = range.to.split('-');
  if (fm === '01' && fd === '01' && tm === '12' && td === '31') {
    return fy === ty ? { big: fy!, small: null } : { big: `${fy}–${ty}`, small: null };
  }
  if (fy === ty && fd === '01' && fm === tm && Number(td) >= 28) return { big: monthName(range.from).toUpperCase(), small: fy! };
  const sameYear = fy === ty;
  return {
    big: sameYear ? fy! : `${fy}–${ty}`,
    small: `${dayName(range.from, !sameYear)} – ${dayName(range.to, true)}`,
  };
}

export interface Persona {
  title: string;
  line: string;
}

/**
 * A listening personality from the busiest three-hour stretch of the day, in
 * the spirit of the ones Spotify hands out.
 */
export function persona(hours: number[]): { persona: Persona; peakHour: number } {
  let peakHour = 0;
  let best = -1;
  for (let h = 0; h < 24; h++) {
    const window = hours[(h + 23) % 24]! + hours[h]! + hours[(h + 1) % 24]!;
    if (window > best) {
      best = window;
      peakHour = h;
    }
  }
  const by: Array<[number, Persona]> = [
    [5, { title: 'The Vampire', line: 'You come alive after midnight.' }],
    [10, { title: 'The Early Bird', line: 'First thing in the morning, headphones in.' }],
    [14, { title: 'The Daydreamer', line: 'Late mornings and long lunches, soundtracked.' }],
    [18, { title: 'The Afternoon Drifter', line: 'The afternoon slump never stood a chance.' }],
    [22, { title: 'The Golden Hour', line: 'Your music hits hardest as the sun goes down.' }],
    [24, { title: 'The Night Owl', line: 'Everyone else was asleep. You were listening.' }],
  ];
  const match = by.find(([until]) => peakHour < until) ?? by[0]!;
  return { persona: match[1], peakHour };
}

export const hourLabel = (hour: number) => {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'am' : 'pm'}`;
};
