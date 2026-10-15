import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ArtistImages, WrappedProps } from '../types';

const WrappedContext = createContext<WrappedProps | null>(null);

export const WrappedProvider = WrappedContext.Provider;

export function useWrapped(): WrappedProps {
  const value = useContext(WrappedContext);
  if (!value) throw new Error('useWrapped outside <Wrapped>');
  return value;
}

/**
 * The best picture of an artist: a live photo if Spotify gave one, else the
 * art of their top song. Matched by id, then by name, since two artists can
 * share a name and an export-only artist has no Spotify id.
 */
export function useArtistImage(artist: { id?: string | null; name: string } | undefined, fallback: string | null): string | null {
  const { artistImages } = useWrapped();
  return pickArtistImage(artistImages, artist, fallback);
}

export function pickArtistImage(images: ArtistImages, artist: { id?: string | null; name: string } | undefined, fallback: string | null): string | null {
  if (!artist) return fallback;
  return (artist.id ? images.ids[artist.id] : undefined) ?? images.names[artist.name.toLowerCase()] ?? fallback;
}

/*
 * Text fitting measures in the DOM, so it must re-run once the web fonts land.
 * One counter for the whole document, bumped whenever it finishes loading
 * fonts, so a font arriving is one update rather than one per text block.
 */
let fontsVersion = 0;
const fontsListeners = new Set<() => void>();
const bumpFonts = () => {
  fontsVersion++;
  fontsListeners.forEach((listener) => listener());
};
if (typeof document !== 'undefined') {
  void document.fonts.ready.then(bumpFonts);
  document.fonts.addEventListener('loadingdone', bumpFonts);
}
const subscribeFonts = (listener: () => void) => {
  fontsListeners.add(listener);
  return () => fontsListeners.delete(listener);
};

export function useFontsVersion(): number {
  return useSyncExternalStore(subscribeFonts, () => fontsVersion, () => 0);
}
