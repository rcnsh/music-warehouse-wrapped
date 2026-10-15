/**
 * The body of the Worker's GET /api/wrapped (music-warehouse src/wrapped.ts),
 * as of its v3 bodies, which carry track and artist ids.
 * Kept by hand: the two repos share no package.
 */
export interface WrappedArtist {
  /** A Spotify artist id, or the export's `name:` placeholder for an artist no play has an id for. */
  id: string;
  name: string;
  minutes: number;
  plays: number;
  share: number;
  days: number;
  longest_run_days: number;
  top_song: string | null;
  top_song_id: string | null;
  image: string | null;
}

export interface WrappedSong {
  track_id: string;
  name: string;
  artist: string;
  artist_id: string;
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
  artist_id: string;
  image: string | null;
  plays: number;
  minutes: number;
  songs: number;
}

export interface WrappedMonth {
  month: string;
  minutes: number;
  top_artist: string | null;
  top_artist_id: string | null;
  top_song: string | null;
  top_song_id: string | null;
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
    top: Array<{ id: string; name: string; minutes: number; image: string | null }>;
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

/** Artist photos from Spotify's live top lists, by Spotify artist id and, as a fallback, by lowercased name. */
export interface ArtistImages {
  ids: Record<string, string>;
  names: Record<string, string>;
}

/** Everything the composition needs. Serializable, so it can be passed as --props. */
export interface WrappedProps extends Record<string, unknown> {
  data: Wrapped;
  artistImages: ArtistImages;
  /** Object or file URL of an optional soundtrack, and where in it to start. */
  audio: { src: string; startSeconds: number } | null;
}
