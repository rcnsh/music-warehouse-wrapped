import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import { HEIGHT, WIDTH } from '../theme';

/**
 * Wrapped's rotating geometric masks: the incoming slide grows out of a
 * turning shape (star, square, triangle or circle) until it covers the frame.
 * Drawn as a clip-path polygon, which the in-browser renderer supports.
 */
export type MaskShape = 'star' | 'square' | 'triangle' | 'circle' | 'burst';

type Props = { shape: MaskShape; turns: number };

const DIAGONAL = Math.hypot(WIDTH, HEIGHT);

function points(shape: MaskShape): Array<[number, number]> {
  const ring = (n: number, inner: number | null, offset = -Math.PI / 2): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    const total = inner === null ? n : n * 2;
    for (let i = 0; i < total; i++) {
      const r = inner !== null && i % 2 === 1 ? inner : 1;
      const a = offset + (i / total) * Math.PI * 2;
      out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out;
  };
  switch (shape) {
    case 'star':
      return ring(5, 0.48);
    case 'burst':
      return ring(12, 0.72);
    case 'square':
      return ring(4, null, Math.PI / 4);
    case 'triangle':
      return ring(3, null);
    case 'circle':
      return ring(48, null);
  }
}

function ShapeWipe({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<Props>) {
  if (presentationDirection === 'exiting') return <AbsoluteFill>{children}</AbsoluteFill>;
  const progress = Easing.inOut(Easing.cubic)(presentationProgress);
  // Large enough at the end that even the star's inner corners clear the frame.
  const scale = interpolate(progress, [0, 1], [0, DIAGONAL * 1.25]);
  const rotation = progress * Math.PI * 2 * passedProps.turns;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const polygon = points(passedProps.shape)
    .map(([x, y]) => {
      const px = WIDTH / 2 + (x * cos - y * sin) * scale;
      const py = HEIGHT / 2 + (x * sin + y * cos) * scale;
      return `${px.toFixed(1)}px ${py.toFixed(1)}px`;
    })
    .join(', ');
  return <AbsoluteFill style={{ clipPath: progress >= 1 ? undefined : `polygon(${polygon})` }}>{children}</AbsoluteFill>;
}

export function shapeWipe(shape: MaskShape, turns = 0.35): TransitionPresentation<Props> {
  return { component: ShapeWipe, props: { shape, turns } };
}
