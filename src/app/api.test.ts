import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../remotion/fixture.json';
import type { Wrapped } from '../types';
import {
  ApiError,
  clearConnection,
  collectArtistImages,
  fetchArtistImages,
  fetchWrapped,
  getConnection,
  parseImagesCache,
  parseStoredConnection,
  retryAfterMs,
  setConnection,
  sleep,
  type Connection,
} from './api';

const wrapped = fixture.data as unknown as Wrapped;
const connection: Connection = { url: 'https://warehouse.example', token: 'mw_test', access: 'read' };

/** A Storage that lives in a Map, since Node has none to lend. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, ...init });

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('location', { origin: 'https://wrapped.example' });
  clearConnection();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('stored connections', () => {
  it('reads one this version wrote', () => {
    expect(parseStoredConnection(JSON.stringify(connection))).toEqual(connection);
  });

  it('drops corrupt JSON rather than throwing at boot', () => {
    expect(parseStoredConnection('{not json')).toBeNull();
    sessionStorage.setItem('mw-wrapped:connection', '{not json');
    expect(getConnection()).toBeNull();
    expect(sessionStorage.getItem('mw-wrapped:connection')).toBeNull();
  });

  it('drops one without a known access level, such as a token an older version stored', () => {
    expect(parseStoredConnection(JSON.stringify({ url: connection.url, token: 'ADMIN' }))).toBeNull();
    expect(parseStoredConnection('null')).toBeNull();
  });

  it('keeps a sign-in for the tab and a pasted token for the page only', () => {
    setConnection(connection, { persist: true });
    expect(sessionStorage.getItem('mw-wrapped:connection')).not.toBeNull();

    const pasted: Connection = { url: connection.url, token: 'secret', access: 'unknown' };
    setConnection(pasted, { persist: false });
    expect(getConnection()).toEqual(pasted);
    expect(sessionStorage.getItem('mw-wrapped:connection')).toBeNull();
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('secret');
  });
});

describe('retryAfterMs', () => {
  it('reads seconds', () => expect(retryAfterMs('3')).toBe(3000));
  it('defaults to 5 s when missing or not a number', () => {
    expect(retryAfterMs(null)).toBe(5000);
    expect(retryAfterMs('')).toBe(5000);
    expect(retryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT')).toBe(5000);
    expect(retryAfterMs('-2')).toBe(5000);
  });
  it('waits at least a second and at most a minute', () => {
    expect(retryAfterMs('0')).toBe(1000);
    expect(retryAfterMs('3600')).toBe(60_000);
  });
});

describe('sleep', () => {
  it('stops listening for abort once it resolves', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    await sleep(1, controller.signal);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('rejects with the reason when aborted, and at once if already aborted', async () => {
    const controller = new AbortController();
    const pending = sleep(10_000, controller.signal);
    controller.abort(new Error('stop'));
    await expect(pending).rejects.toThrow('stop');
    await expect(sleep(10_000, controller.signal)).rejects.toThrow('stop');
  });
});

describe('fetchWrapped', () => {
  it('returns the body, asking with the bearer token and the range', async () => {
    const fetch = vi.fn(async () => json(wrapped));
    vi.stubGlobal('fetch', fetch);
    const body = await fetchWrapped(connection, '2025-01-01', '2025-12-31');
    expect(body.range).toEqual({ from: '2025-01-01', to: '2025-12-31', days: 365 });
    expect(body.top_artists[0]).toMatchObject({ id: expect.any(String), name: 'Velvet Static' });
    expect(fetch).toHaveBeenCalledWith('https://warehouse.example/api/wrapped?from=2025-01-01&to=2025-12-31', expect.objectContaining({ headers: { Authorization: 'Bearer mw_test' } }));
  });

  it('waits 5 s after a 503 whose Retry-After is not a number, then tries again', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ error: 'Computing' }, { status: 503, headers: { 'Retry-After': 'soon' } }))
      .mockResolvedValueOnce(json(wrapped));
    vi.stubGlobal('fetch', fetch);
    const pending = fetchWrapped(connection, '2025-01-01', '2025-12-31');
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ totals: wrapped.totals });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("passes on the warehouse's 403 for a range a read token may not compute", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'This range has not been computed.' }, { status: 403 })));
    const error = await fetchWrapped(connection, '2025-03-01', '2025-03-31').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, message: 'This range has not been computed.' });
  });
});

describe('artist images', () => {
  const top = (items: unknown[]) => ({ artists: { items } });

  it('maps /api/top artists by id and by lowercased name, largest image first', () => {
    const images = collectArtistImages(
      top([
        { id: 'a1', name: 'Velvet Static', images: [{ url: 'https://i.scdn.co/640', width: 640 }, { url: 'https://i.scdn.co/160', width: 160 }] },
        { id: 'a2', name: 'No Photo', images: [] },
        { name: 'Nameless Id' },
        null,
      ]),
    );
    expect(images).toEqual({ ids: { a1: 'https://i.scdn.co/640' }, names: { 'velvet static': 'https://i.scdn.co/640' } });
  });

  it('keeps the first photo found when a later list repeats an artist', () => {
    const images = collectArtistImages(top([{ id: 'a1', name: 'A', images: [{ url: 'first' }] }]));
    collectArtistImages(top([{ id: 'a1', name: 'A', images: [{ url: 'second' }] }]), images);
    expect(images.ids.a1).toBe('first');
  });

  it('tolerates a body without artists', () => {
    expect(collectArtistImages(null)).toEqual({ ids: {}, names: {} });
    expect(collectArtistImages({ tracks: {} })).toEqual({ ids: {}, names: {} });
  });

  it('uses a fresh cache for the same warehouse only, and survives a corrupt one', () => {
    const images = { ids: { a1: 'x' }, names: { a: 'x' } };
    const cache = JSON.stringify({ at: 1000, url: connection.url, images });
    expect(parseImagesCache(cache, connection.url, 2000)).toEqual(images);
    expect(parseImagesCache(cache, 'https://other.example', 2000)).toBeNull();
    expect(parseImagesCache(cache, connection.url, 1000 + 8 * 86_400_000)).toBeNull();
    expect(parseImagesCache('{oops', connection.url, 2000)).toBeNull();
    // The v1 shape, a flat name map.
    expect(parseImagesCache(JSON.stringify({ at: 1000, url: connection.url, images: { a: 'x' } }), connection.url, 2000)).toBeNull();
  });

  it('fetches both top lists once, caches them, and recovers from a corrupt cache', async () => {
    localStorage.setItem('mw-wrapped:artist-images:v2', '{oops');
    const fetch = vi.fn(async (url: string) =>
      json(top([{ id: url.includes('medium_term') ? 'm' : 'l', name: 'X', images: [{ url: url.includes('medium_term') ? 'medium' : 'long' }] }])),
    );
    vi.stubGlobal('fetch', fetch);
    const images = await fetchArtistImages(connection);
    expect(images).toEqual({ ids: { m: 'medium', l: 'long' }, names: { x: 'medium' } });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await fetchArtistImages(connection)).toBe(images);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('mw-wrapped:artist-images:v2')!).images).toEqual(images);
  });
});
