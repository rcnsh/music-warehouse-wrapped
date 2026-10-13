import { createContext, useContext, useEffect, useState } from 'react';
import type { WrappedProps } from '../types';

const WrappedContext = createContext<WrappedProps | null>(null);

export const WrappedProvider = WrappedContext.Provider;

export function useWrapped(): WrappedProps {
  const value = useContext(WrappedContext);
  if (!value) throw new Error('useWrapped outside <Wrapped>');
  return value;
}

/** The best picture of an artist: a live photo if Spotify gave one, else the art of their top song. */
export function useArtistImage(name: string, fallback: string | null): string | null {
  const { artistImages } = useWrapped();
  return artistImages[name.toLowerCase()] ?? fallback;
}

/**
 * Text fitting measures in the DOM, so it must re-run once the web fonts land.
 * Bumps a counter whenever the document finishes loading fonts.
 */
export function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    const bump = () => alive && setVersion((v) => v + 1);
    void document.fonts.ready.then(bump);
    document.fonts.addEventListener('loadingdone', bump);
    return () => {
      alive = false;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);
  return version;
}
