import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadMarker } from '@remotion/google-fonts/PermanentMarker';
import { loadFont as loadMono } from '@remotion/google-fonts/SpaceMono';

/**
 * The 2025 Wrapped look, as Spotify described it: a "visual mixtape" built
 * on the black and white of photocopied zines and cassette inserts, with
 * colour held back for key moments. Collage, cut-outs, tape, marker doodles
 * and grain; type that scales up until it fills the frame.
 *
 * Spotify Mix is proprietary, so the poster face is Anton (a tall condensed
 * grotesk), with Archivo for running text, Permanent Marker for the
 * handwritten asides and Space Mono for the receipt-like figures.
 */

export const FONTS = {
  poster: loadAnton('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] }).fontFamily,
  body: loadArchivo('normal', { weights: ['500', '700', '800', '900'], subsets: ['latin', 'latin-ext'] }).fontFamily,
  marker: loadMarker('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily,
  mono: loadMono('normal', { weights: ['400', '700'], subsets: ['latin', 'latin-ext'] }).fontFamily,
};

export const INK = '#0b0b0b';
export const PAPER = '#f1ede4';

/** Pops of colour, one per moment. */
export const POP = {
  green: '#1ed760',
  acid: '#d4ff3a',
  pink: '#ff4fbf',
  blue: '#3b5bff',
  orange: '#ff6a1f',
  yellow: '#ffe14a',
  violet: '#9b5cff',
  red: '#ff3b30',
} as const;

export type Pop = (typeof POP)[keyof typeof POP];

export { FPS, HEIGHT, WIDTH } from './dimensions';

/** Springs used across slides, so motion has one personality. */
export const SPRING = {
  snappy: { damping: 14, stiffness: 180, mass: 0.6 },
  bouncy: { damping: 9, stiffness: 140, mass: 0.7 },
  soft: { damping: 22, stiffness: 90, mass: 1 },
} as const;
