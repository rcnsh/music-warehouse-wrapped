/**
 * The body of the Worker's GET /api/wrapped (music-warehouse src/wrapped.ts).
 * Kept by hand: the two repos share no package.
 */
export interface WrappedArtist {
  name: string;
  minutes: number;
  plays: number;
  share: number;
  days: number;
  longest_run_days: number;
  top_song: string | null;
  image: string | null;
}

export interface WrappedSong {
  name: string;
  artist: string;
  album: string | null;
  image: string | null;
  plays: number;
  minutes: number;
  peak_month: string;
  first_played: string;
}

export interface WrappedAlbum {
  name: string;
  artist: string;
  image: string | null;
  plays: number;
  minutes: number;
  songs: number;
}

export interface WrappedMonth {
  month: string;
  minutes: number;
  top_artist: string | null;
  top_song: string | null;
  image: string | null;
}

export interface Wrapped {
  range: { from: string; to: string; days: number };
  computed_at: string;
  totals: { minutes: number; plays: number; skips: number; days_listened: number; artists: number; songs: number };
  biggest_day: { date: string; minutes: number } | null;
  hours: number[];
  weekdays: number[];
  top_artists: WrappedArtist[];
  top_songs: WrappedSong[];
  top_albums: WrappedAlbum[];
  months: WrappedMonth[];
  discoveries: {
    artists: number;
    songs: number;
    share: number;
    top: Array<{ name: string; minutes: number; image: string | null }>;
  };
  listening_age: {
    age: number;
    median_year: number;
    window: [number, number];
    coverage: number;
    decades: Array<{ decade: number; share: number }>;
  } | null;
  streak: { days: number; from: string; to: string } | null;
}

/** Everything the composition needs. Serializable, so it can be passed as --props. */
export interface WrappedProps extends Record<string, unknown> {
  data: Wrapped;
  /** Lowercased artist name → photo, from Spotify's live top lists where the artist appears. */
  artistImages: Record<string, string>;
  /** Object or file URL of an optional soundtrack, and where in it to start. */
  audio: { src: string; startSeconds: number } | null;
}
