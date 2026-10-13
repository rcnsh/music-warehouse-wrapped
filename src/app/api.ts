import type { Wrapped } from '../types';

/**
 * Talks to the warehouse through this app's own Worker (worker/index.ts), so
 * every request is same-origin. The token is the warehouse's ADMIN_TOKEN (to
 * compute a new range) or READ_TOKEN (to view ranges already computed). It
 * lives in sessionStorage only: closing the tab forgets it.
 */

const TOKEN_KEY = 'mw-wrapped:token';
const IMAGES_KEY = 'mw-wrapped:artist-images';
/** Artist photos barely change, and /api/top is expensive for the warehouse's D1 budget. */
const IMAGES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token.trim());
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

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

/**
 * A range's Wrapped. A 503 means another request is computing it; the
 * response says when to look again.
 */
export async function fetchWrapped(token: string, from: string, to: string, signal?: AbortSignal): Promise<Wrapped> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(`/api/wrapped?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (response.status === 503) {
      await sleep(Number(response.headers.get('Retry-After') ?? 5) * 1000, signal);
      continue;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(response.status, body?.error ?? `The warehouse answered ${response.status}.`);
    }
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

export function fetchArtistImages(token: string): Promise<Record<string, string>> {
  // One request per page load, however many components ask.
  inFlight ??= loadArtistImages(token);
  return inFlight;
}

async function loadArtistImages(token: string): Promise<Record<string, string>> {
  const cached = localStorage.getItem(IMAGES_KEY);
  if (cached) {
    const { at, images } = JSON.parse(cached) as { at: number; images: Record<string, string> };
    if (Date.now() - at < IMAGES_TTL_MS) return images;
  }
  const images: Record<string, string> = {};
  for (const range of ['medium_term', 'long_term']) {
    try {
      const response = await fetch(`/api/top?range=${range}&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
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
  if (Object.keys(images).length > 0) localStorage.setItem(IMAGES_KEY, JSON.stringify({ at: Date.now(), images }));
  return images;
}
