import { fitText, fitTextOnNLines } from '@remotion/layout-utils';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { AbsoluteFill, Img, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFontsVersion } from '../context';
import { FONTS, INK, PAPER, SPRING } from '../theme';

/*
 * Collage primitives. Everything here draws with properties Remotion's
 * in-browser renderer supports (transforms, clip-path polygons, gradients,
 * basic shadows), and stacks in DOM order, because that renderer ignores
 * z-index.
 */

/**
 * Stop-motion wobble: a small offset and turn that changes every `every`
 * frames, like hand-moved paper cut-outs.
 */
export function useJitter(seed: string, amount = 1, every = 4) {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / every);
  return {
    x: (random(`${seed}x${step}`) - 0.5) * 6 * amount,
    y: (random(`${seed}y${step}`) - 0.5) * 6 * amount,
    r: (random(`${seed}r${step}`) - 0.5) * 1.6 * amount,
  };
}

/** A spring from 0 to 1 starting at `delay` frames. */
export function useEnter(delay = 0, config: keyof typeof SPRING = 'snappy') {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: SPRING[config] });
}

let grainUrl: string | null = null;

/** A tile of monochrome noise, made once per page. */
function grain(): string {
  if (grainUrl) return grainUrl;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  // Seeded, so every render of every frame grains the same way.
  for (let i = 0; i < size * size; i++) {
    const v = random(`grain${i}`) * 255;
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = random(`grain-a${i}`) * 70;
  }
  ctx.putImageData(image, 0, 0);
  grainUrl = canvas.toDataURL('image/png');
  return grainUrl;
}

/** Photocopy grain over everything, shifting at 12 fps like film. */
export function Grain({ opacity = 0.5 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const url = useMemo(grain, []);
  const step = Math.floor(frame / 2.5);
  const dx = Math.floor(random(`gx${step}`) * 256);
  const dy = Math.floor(random(`gy${step}`) * 256);
  const tiles: ReactNode[] = [];
  for (let y = -256; y < height; y += 256) {
    for (let x = -256; x < width; x += 256) {
      tiles.push(
        <Img
          key={`${x}:${y}`}
          src={url}
          style={{ position: 'absolute', left: x + dx, top: y + dy, width: 256, height: 256, imageRendering: 'pixelated' }}
        />,
      );
    }
  }
  return <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>{tiles}</AbsoluteFill>;
}

/** A strip of masking tape with torn ends. */
export function Tape({ x, y, rotate, width = 220, color = 'rgba(241, 237, 228, 0.82)', seed = 'tape' }: {
  x: number;
  y: number;
  rotate: number;
  width?: number;
  color?: string;
  seed?: string;
}) {
  const teeth = 6;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const t = (i / teeth) * 100;
    left.push(`${random(`${seed}l${i}`) * 5}% ${t}%`);
    right.unshift(`${100 - random(`${seed}r${i}`) * 5}% ${t}%`);
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - 28,
        width,
        height: 56,
        background: color,
        transform: `rotate(${rotate}deg)`,
        clipPath: `polygon(${[...left, ...right].join(', ')})`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      }}
    />
  );
}

/** A jagged paper edge, as a clip-path polygon across the top and bottom of a box. */
export function tornPolygon(seed: string, teeth = 28, depth = 2.4): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    top.push(`${x}% ${random(`${seed}t${i}`) * depth}%`);
    bottom.unshift(`${x}% ${100 - random(`${seed}b${i}`) * depth}%`);
  }
  return `polygon(${[...top, ...bottom].join(', ')})`;
}

/** A torn strip of paper holding its children. */
export function Torn({ children, style, color = PAPER, seed = 'torn', depth = 2.4 }: {
  children: ReactNode;
  style?: CSSProperties;
  color?: string;
  seed?: string;
  depth?: number;
}) {
  return (
    <div style={{ background: color, clipPath: tornPolygon(seed, 28, depth), padding: '34px 44px', ...style }}>{children}</div>
  );
}

/**
 * A photo cut out and stuck down: white border, slight turn, drop shadow.
 * Falls back to a flat colour block when there's no image.
 */
export function Cutout({ src, size, rotate = 0, border = 14, style, fallback = '#222' }: {
  src: string | null;
  size: number;
  rotate?: number;
  border?: number;
  style?: CSSProperties;
  fallback?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        padding: border,
        background: '#fbfaf6',
        transform: `rotate(${rotate}deg)`,
        boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {src ? (
        <Img src={src} crossOrigin="anonymous" style={{ width: size - border * 2, height: size - border * 2, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: size - border * 2, height: size - border * 2, background: fallback }} />
      )}
    </div>
  );
}

/** Condensed poster type sized to exactly fill `width`. */
export function Poster({ text, width, max = 900, color = INK, style, upper = true }: {
  text: string;
  width: number;
  max?: number;
  color?: string;
  style?: CSSProperties;
  upper?: boolean;
}) {
  useFontsVersion();
  const shown = upper ? text.toUpperCase() : text;
  const { fontSize } = fitText({ text: shown, withinWidth: width, fontFamily: FONTS.poster, validateFontIsLoaded: false });
  return (
    <div
      style={{
        fontFamily: FONTS.poster,
        fontSize: Math.min(max, fontSize),
        lineHeight: 0.86,
        color,
        whiteSpace: 'nowrap',
        width,
        ...style,
      }}
    >
      {shown}
    </div>
  );
}

/** Poster type wrapped onto at most `lines` lines, each filling the width it can. */
export function PosterLines({ text, width, lines = 3, max = 300, color = INK, align = 'left' }: {
  text: string;
  width: number;
  lines?: number;
  max?: number;
  color?: string;
  align?: CSSProperties['textAlign'];
}) {
  useFontsVersion();
  const shown = text.toUpperCase();
  const fit = fitTextOnNLines({ text: shown, maxBoxWidth: width, maxLines: lines, fontFamily: FONTS.poster, maxFontSize: max, validateFontIsLoaded: false });
  return (
    <div style={{ fontFamily: FONTS.poster, fontSize: fit.fontSize, lineHeight: 0.9, color, width, textAlign: align }}>
      {fit.lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

/** A handwritten aside. */
export function Marker({ children, size = 64, color = INK, rotate = -4, style }: {
  children: ReactNode;
  size?: number;
  color?: string;
  rotate?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ fontFamily: FONTS.marker, fontSize: size, color, transform: `rotate(${rotate}deg)`, lineHeight: 1.05, ...style }}>
      {children}
    </div>
  );
}

/** Receipt-style figures. */
export function Mono({ children, size = 36, color = INK, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: FONTS.mono, fontSize: size, color, letterSpacing: '0.02em', lineHeight: 1.35, ...style }}>{children}</div>
  );
}

/** A label slapped on at an angle, highlighter-style. */
export function Sticker({ children, color, ink = INK, rotate = -3, size = 56, style }: {
  children: ReactNode;
  color: string;
  ink?: string;
  rotate?: number;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'inline-block',
        background: color,
        color: ink,
        fontFamily: FONTS.body,
        fontWeight: 900,
        fontSize: size,
        padding: '6px 22px 10px',
        transform: `rotate(${rotate}deg)`,
        textTransform: 'uppercase',
        letterSpacing: '-0.01em',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A marker doodle drawn on over `duration` frames: the path's dash offset
 * runs from its full length to zero.
 */
export function Doodle({ d, length, x, y, width, height, viewBox, color = INK, stroke = 10, delay = 0, duration = 14, stretch = false }: {
  d: string;
  length: number;
  x: number;
  y: number;
  width: number;
  height: number;
  viewBox: string;
  color?: string;
  stroke?: number;
  delay?: number;
  duration?: number;
  /** Fill the box rather than keeping the doodle's proportions. */
  stretch?: boolean;
}) {
  const frame = useCurrentFrame();
  const drawn = interpolate(frame - delay, [0, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (drawn === 0) return null;
  return (
    <svg viewBox={viewBox} width={width} height={height} preserveAspectRatio={stretch ? 'none' : undefined} style={{ position: 'absolute', left: x, top: y, overflow: 'visible' }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - drawn)}
      />
    </svg>
  );
}

/** Ready-made doodles, in a 100×100 (or wider) box. */
export const DOODLES = {
  circle: { d: 'M50 6 C 80 4, 98 26, 96 52 C 94 80, 70 96, 46 94 C 18 92, 2 70, 6 44 C 9 22, 30 8, 58 10', length: 300, viewBox: '0 0 100 100' },
  underline: { d: 'M2 12 C 40 4, 90 18, 140 8 S 230 4, 296 12', length: 310, viewBox: '0 0 300 20' },
  arrow: { d: 'M6 90 C 30 60, 50 40, 88 14 M 62 12 L 90 12 L 84 40', length: 190, viewBox: '0 0 100 100' },
  star: { d: 'M50 4 L 61 38 L 96 38 L 68 59 L 79 94 L 50 72 L 21 94 L 32 59 L 4 38 L 39 38 Z', length: 360, viewBox: '0 0 100 100' },
  squiggle: { d: 'M4 50 C 16 20, 28 80, 40 50 S 64 20, 76 50 S 100 80, 112 50 S 136 20, 148 50', length: 240, viewBox: '0 0 152 100' },
  burst: { d: 'M50 2 L 50 22 M50 78 L 50 98 M2 50 L 22 50 M78 50 L 98 50 M16 16 L 30 30 M70 70 L 84 84 M84 16 L 70 30 M30 70 L 16 84', length: 400, viewBox: '0 0 100 100' },
} as const;

/**
 * A column of text blocks pinned to the bottom of the frame. Each block
 * pushes the next one down rather than sitting at a fixed height, so a name
 * that wraps to two lines can never land on the line below it.
 */
export function Stack({ children, left = 80, bottom = 150, width = 920, gap = 24, style }: {
  children: ReactNode;
  left?: number;
  bottom?: number;
  width?: number;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'absolute', left, bottom, width, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap, ...style }}>
      {children}
    </div>
  );
}
