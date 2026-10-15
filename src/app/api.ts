import type { ArtistImages, Wrapped } from '../types';

/**
 * Talks straight from the browser to the reader's own music-warehouse, at the
 * URL they give. Nothing goes through this app's server, which serves static
 * files only; the warehouse has to list this origin in its CORS_ORIGINS.
 *
 * The token should be a read token: the one Spotify sign-in mints, or a read
 * device token. Never the warehouse's ADMIN_TOKEN, which can mint and revoke
 * tokens and has no business in a public web page. The warehouse precomputes
 * its preset ranges, so a read token is all this app needs.
 *
 * A sign-in token is kept in sessionStorage, so it survives a reload of this
 * tab and nothing else. A pasted token is held in memory only: this page
 * can't tell a read token from an admin one without spending a compute, so it
 * treats any pasted token as one it must not write down.
 */

export interface Connection {
  url: string;
  token: string;
  /**
   * 'read' once the app knows the token can only open presets and ranges
   * already computed: a Spotify sign-in always is, and a pasted token turns out
   * to be when the warehouse refuses a range with 403.
   */
  access: 'read' | 'unknown';
}

const CONNECTION_KEY = 'mw-wrapped:connection';
/** v2 is keyed by artist id as well as name. */
const IMAGES_KEY = 'mw-wrapped:artist-images:v2';
const OLD_IMAGES_KEYS = ['mw-wrapped:artist-images'];
/** Artist photos barely change, and each /api/top is two Spotify calls through the warehouse. */
const IMAGES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The connection for this page, if it was pasted rather than signed in. */
let pasted: Connection | null = null;

/**
 * A stored connection, or null if there is none or it isn't one this version
 * wrote. Only sign-in connections are stored, so anything else (including a
 * token an older version stored before it stopped storing pasted ones) is
 * dropped rather than trusted.
 */
export function parseStoredConnection(raw: string | null): Connection | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Connection> | null;
    if (typeof value?.url !== 'string' || typeof value.token !== 'string' || value.access !== 'read') return null;
    return { url: value.url, token: value.token, access: 'read' };
  } catch {
    return null;
  }
}

export function getConnection(): Connection | null {
  if (pasted) return pasted;
  const raw = sessionStorage.getItem(CONNECTION_KEY);
  const connection = parseStoredConnection(raw);
  if (raw && !connection) sessionStorage.removeItem(CONNECTION_KEY);
  return connection;
}

/** Keeps a sign-in connection for this tab; a pasted one for this page load only. */
export function setConnection(connection: Connection, { persist }: { persist: boolean }) {
  if (persist) {
    pasted = null;
    sessionStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
  } else {
    pasted = connection;
    sessionStorage.removeItem(CONNECTION_KEY);
  }
}

/** Records that the current token can't compute arbitrary ranges. */
export function markReadOnly() {
  if (pasted) pasted = { ...pasted, access: 'read' };
}

export function clearConnection() {
  pasted = null;
  sessionStorage.removeItem(CONNECTION_KEY);
  for (const key of [IMAGES_KEY, ...OLD_IMAGES_KEYS]) localStorage.removeItem(key);
  inFlight = null;
}

/**
 * The warehouse's origin, from whatever the reader pasted. HTTPS only, bar a
 * local dev server, since the token rides along in a header.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("That doesn't look like a URL.");
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('The warehouse URL must use https.');
  return url.origin;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** How long a 503 asks to wait: Retry-After in seconds (1 s to a minute), else 5 s. */
export function retryAfterMs(header: string | null): number {
  const seconds = header === null || header.trim() === '' ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(Math.max(seconds, 1), 60) * 1000 : 5000;
}

async function get(connection: Connection, path: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(`${connection.url}${path}`, { headers: { Authorization: `Bearer ${connection.token}` }, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    // A refused CORS preflight and an unreachable host look the same from here.
    throw new ApiError(0, `Couldn't reach ${connection.url}. Check the URL, and that the warehouse lists ${location.origin} in CORS_ORIGINS.`);
  }
}

async function failure(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new ApiError(response.status, body?.error ?? `The warehouse answered ${response.status}.`);
}

export interface WrappedPreset {
  from: string;
  to: string;
  label: string;
  kind?: 'year' | 'year_to_date';
  computed: boolean;
}

/**
 * The warehouse's own presets: each year that has plays, and this year so far.
 * A read token can open these whether or not they are computed yet: the
 * warehouse computes a preset on request, and warms them from its cron. Doubles as
 * the check that the URL and token work.
 */
export async function fetchPresets(connection: Connection, signal?: AbortSignal): Promise<WrappedPreset[]> {
  const response = await get(connection, '/api/wrapped/ranges', signal);
  if (!response.ok) throw await failure(response);
  return ((await response.json()) as { ranges: WrappedPreset[] }).ranges;
}

/**
 * A range's Wrapped. A 503 means another request is computing it; the
 * response says when to look again. A 403 means a read token asked for a range
 * that isn't a preset and hasn't been computed.
 */
export async function fetchWrapped(connection: Connection, from: string, to: string, signal?: AbortSignal): Promise<Wrapped> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await get(connection, `/api/wrapped?from=${from}&to=${to}`, signal);
    if (response.status === 503) {
      await sleep(retryAfterMs(response.headers.get('Retry-After')), signal);
      continue;
    }
    if (!response.ok) throw await failure(response);
    return (await response.json()) as Wrapped;
  }
  throw new ApiError(503, 'The warehouse is still computing this range. Try again in a minute.');
}

type TopArtists = {
  artists?: { items?: Array<{ id?: string; name?: string; images?: Array<{ url?: string; width?: number | null }> }> };
};

/** Folds one /api/top artists body into the photo maps, keeping photos already found. */
export function collectArtistImages(body: unknown, into: ArtistImages = { ids: {}, names: {} }): ArtistImages {
  for (const artist of (body as TopArtists | null)?.artists?.items ?? []) {
    // Largest first: 640px, about the size the reveal shows it.
    const url = artist?.images?.[0]?.url;
    if (typeof url !== 'string' || !url) continue;
    if (typeof artist.id === 'string' && artist.id) into.ids[artist.id] ??= url;
    if (typeof artist.name === 'string' && artist.name) into.names[artist.name.toLowerCase()] ??= url;
  }
  return into;
}

/** Cached photos for this warehouse if they are still fresh; null if absent, stale, for another warehouse or unreadable. */
export function parseImagesCache(raw: string | null, url: string, now: number): ArtistImages | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { at?: unknown; url?: unknown; images?: Partial<ArtistImages> } | null;
    const images = value?.images;
    if (typeof value?.at !== 'number' || value.url !== url || now - value.at >= IMAGES_TTL_MS) return null;
    if (!images || typeof images.ids !== 'object' || typeof images.names !== 'object' || !images.ids || !images.names) return null;
    return { ids: images.ids, names: images.names };
  } catch {
    return null;
  }
}

/**
 * Artist photos, by Spotify id and by lowercased name, from Spotify's live
 * top-artist lists. `recently-played` never carries artist images, so these
 * are the only photos there are; anyone outside both lists keeps the art of
 * their top song. Best effort: a dead Spotify grant just means no photos.
 */
let inFlight: Promise<ArtistImages> | null = null;

export function fetchArtistImages(connection: Connection): Promise<ArtistImages> {
  // One request per page load, however many components ask.
  inFlight ??= loadArtistImages(connection).catch(() => {
    inFlight = null;
    return { ids: {}, names: {} };
  });
  return inFlight;
}

async function loadArtistImages(connection: Connection): Promise<ArtistImages> {
  const raw = localStorage.getItem(IMAGES_KEY);
  const cached = parseImagesCache(raw, connection.url, Date.now());
  if (cached) return cached;
  if (raw) localStorage.removeItem(IMAGES_KEY);
  const images: ArtistImages = { ids: {}, names: {} };
  for (const range of ['medium_term', 'long_term']) {
    try {
      const response = await get(connection, `/api/top?range=${range}&limit=50&type=artists`);
      if (!response.ok) continue;
      collectArtistImages(await response.json(), images);
    } catch {
      // Photos are decoration.
    }
  }
  if (Object.keys(images.ids).length + Object.keys(images.names).length > 0) {
    try {
      localStorage.setItem(IMAGES_KEY, JSON.stringify({ at: Date.now(), url: connection.url, images }));
    } catch {
      // A full or blocked store just means fetching again next time.
    }
  }
  return images;
}
