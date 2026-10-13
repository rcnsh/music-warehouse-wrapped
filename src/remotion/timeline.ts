import type { Wrapped } from '../types';
import { FPS } from './theme';

export type SlideId =
  | 'intro'
  | 'minutes'
  | 'clock'
  | 'artist-tease'
  | 'artist'
  | 'artists'
  | 'song'
  | 'songs'
  | 'album'
  | 'age'
  | 'discoveries'
  | 'months'
  | 'streak'
  | 'summary';

interface SlideSpec {
  id: SlideId;
  seconds: number;
  /** Whether the data supports this slide at all. */
  when: (data: Wrapped) => boolean;
}

/** Frames each transition overlaps the slides either side of it. */
export const TRANSITION_FRAMES = 16;

const SLIDES: SlideSpec[] = [
  { id: 'intro', seconds: 5, when: () => true },
  { id: 'minutes', seconds: 6.5, when: (d) => d.totals.minutes > 0 },
  { id: 'clock', seconds: 6, when: (d) => d.hours.some((m) => m > 0) },
  { id: 'artist-tease', seconds: 3, when: (d) => d.top_artists.length > 0 },
  { id: 'artist', seconds: 6.5, when: (d) => d.top_artists.length > 0 },
  { id: 'artists', seconds: 6.5, when: (d) => d.top_artists.length >= 3 },
  { id: 'song', seconds: 6.5, when: (d) => d.top_songs.length > 0 },
  { id: 'songs', seconds: 8, when: (d) => d.top_songs.length >= 3 },
  { id: 'album', seconds: 5.5, when: (d) => d.top_albums.length > 0 },
  { id: 'age', seconds: 6.5, when: (d) => d.listening_age !== null },
  // When the range starts with the history, everything is "new".
  { id: 'discoveries', seconds: 6.5, when: (d) => d.discoveries.artists > 0 && d.discoveries.share < 0.9 },
  { id: 'months', seconds: 8, when: (d) => d.months.length >= 3 },
  { id: 'streak', seconds: 5.5, when: (d) => (d.streak?.days ?? 0) >= 3 },
  { id: 'summary', seconds: 9, when: (d) => d.top_artists.length > 0 },
];

export interface PlacedSlide {
  id: SlideId;
  /** First frame on which this slide is the one being shown (after its entrance). */
  from: number;
  durationInFrames: number;
}

/** The slides this data supports, with where each starts once transitions overlap them. */
export function timeline(data: Wrapped): { slides: PlacedSlide[]; durationInFrames: number } {
  const slides: PlacedSlide[] = [];
  let at = 0;
  for (const spec of SLIDES) {
    if (!spec.when(data)) continue;
    const durationInFrames = Math.round(spec.seconds * FPS);
    // Each slide after the first starts while the previous one is leaving.
    const from = slides.length === 0 ? 0 : at - TRANSITION_FRAMES;
    slides.push({ id: spec.id, from, durationInFrames });
    at = from + durationInFrames;
  }
  return { slides, durationInFrames: Math.max(1, at) };
}
