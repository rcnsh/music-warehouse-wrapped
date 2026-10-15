import { describe, expect, it } from 'vitest';
import { pickArtistImage } from './context';

describe('pickArtistImage', () => {
  const images = { ids: { a1: 'by-id' }, names: { 'velvet static': 'by-name' } };

  it('prefers the id, so two artists sharing a name keep their own photos', () => {
    expect(pickArtistImage(images, { id: 'a1', name: 'Someone Else' }, 'fallback')).toBe('by-id');
  });

  it('falls back to the name, then to the given image', () => {
    expect(pickArtistImage(images, { id: 'name:velvet static', name: 'Velvet Static' }, 'fallback')).toBe('by-name');
    expect(pickArtistImage(images, { id: 'zz', name: 'Unknown' }, 'fallback')).toBe('fallback');
    expect(pickArtistImage(images, undefined, null)).toBeNull();
  });
});
