import type { Wrapped } from '../types';

/**
 * Talks straight from the browser to the reader's own music-warehouse, at the
 * URL they give. Nothing goes through this app's server, which serves static
 * files only; the warehouse has to list this origin in its CORS_ORIGINS.
 *
 * The token is the warehouse's ADMIN_TOKEN (to compute a new range) or
 * READ_TOKEN (to view presets and ranges already computed). Both live in
 * sessionStorage only: closing the tab forgets them.
 */

export interface Connection {
  url: string;
  token: string;
}

const CONNECTION_KEY = 'mw-wrapped:connection';
const IMAGES_KEY = 'mw-wrapped:artist-images';
/** Artist photos barely change, and each /api/top is two Spotify calls through the warehouse. */
const IMAGES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getConnection(): Connection | null {
  const stored = sessionStorage.getItem(CONNECTION_KEY);
  return stored ? (JSON.parse(stored) as Connection) : null;
}

export function setConnection(connection: Connection) {
  sessionStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
}

export function clearConnection() {
  sessionStorage.removeItem(CONNECTION_KEY);
  localStorage.removeItem(IMAGES_KEY);
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

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

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
  computed: boolean;
}

/**
 * The warehouse's own presets: each year that has plays, and this year so far.
 * A read token can open these whether or not they are computed yet. Doubles as
 * the check that the URL and token work.
 */
export async function fetchPresets(connection: Connection, signal?: AbortSignal): Promise<WrappedPreset[]> {
  const response = await get(connection, '/api/wrapped/ranges', signal);
  if (!response.ok) throw await failure(response);
  return ((await response.json()) as { ranges: WrappedPreset[] }).ranges;
}

/**
 * A range's Wrapped. A 503 means another request is computing it; the
 * response says when to look again.
 */
export async function fetchWrapped(connection: Connection, from: string, to: string, signal?: AbortSignal): Promise<Wrapped> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await get(connection, `/api/wrapped?from=${from}&to=${to}`, signal);
    if (response.status === 503) {
      await sleep(Number(response.headers.get('Retry-After') ?? 5) * 1000, signal);
      continue;
    }
    if (!response.ok) throw await failure(response);
    return (await response.json()) as Wrapped;
  }
  throw new ApiError(503, 'The warehouse is still computing this range. Try again in a minute.');
}

type TopArtists = { artists?: { items?: Array<{ name?: string; images?: Array<{ url?: string; width?: number | null }> }> } };

/**
 * Lowercased artist name → photo, from Spotify's live top-artist lists.
 * `recently-played` never carries artist images, so these are the only photos
 * there are; anyone outside both lists keeps the art of their top song.
 * Best effort: a dead Spotify grant just means no photos.
 */
let inFlight: Promise<Record<string, string>> | null = null;

export function fetchArtistImages(connection: Connection): Promise<Record<string, string>> {
  // One request per page load, however many components ask.
  inFlight ??= loadArtistImages(connection);
  return inFlight;
}

async function loadArtistImages(connection: Connection): Promise<Record<string, string>> {
  const cached = localStorage.getItem(IMAGES_KEY);
  if (cached) {
    const { at, url, images } = JSON.parse(cached) as { at: number; url?: string; images: Record<string, string> };
    if (url === connection.url && Date.now() - at < IMAGES_TTL_MS) return images;
  }
  const images: Record<string, string> = {};
  for (const range of ['medium_term', 'long_term']) {
    try {
      const response = await get(connection, `/api/top?range=${range}&limit=50&type=artists`);
      if (!response.ok) continue;
      const body = (await response.json()) as TopArtists;
      for (const artist of body.artists?.items ?? []) {
        // Largest first: 640px, about the size the reveal shows it.
        const url = artist.images?.[0]?.url;
        if (artist.name && url) images[artist.name.toLowerCase()] = url;
      }
    } catch {
      // Photos are decoration.
    }
  }
  if (Object.keys(images).length > 0) localStorage.setItem(IMAGES_KEY, JSON.stringify({ at: Date.now(), url: connection.url, images }));
  return images;
}
