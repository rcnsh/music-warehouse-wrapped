import { Audio } from '@remotion/media';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { Fragment, type ComponentType } from 'react';
import { AbsoluteFill, type CalculateMetadataFunction, interpolate } from 'remotion';
import type { WrappedProps } from '../types';
import { WrappedProvider } from './context';
import { Intro, Clock, Minutes } from './slides/opening';
import { Artist, Artists, ArtistTease } from './slides/artists';
import { Album, Song, Songs } from './slides/songs';
import { Age, Discoveries, Months, Streak, Summary } from './slides/later';
import { FPS } from './theme';
import { type SlideId, timeline, TRANSITION_FRAMES } from './timeline';
import { Grain } from './ui/collage';
import { type MaskShape, shapeWipe } from './ui/transitions';

const SLIDE_COMPONENTS: Record<SlideId, ComponentType> = {
  intro: Intro,
  minutes: Minutes,
  clock: Clock,
  'artist-tease': ArtistTease,
  artist: Artist,
  artists: Artists,
  song: Song,
  songs: Songs,
  album: Album,
  age: Age,
  discoveries: Discoveries,
  months: Months,
  streak: Streak,
  summary: Summary,
};

/** Cycled through, so consecutive transitions never repeat a shape. */
const SHAPES: MaskShape[] = ['star', 'square', 'circle', 'triangle', 'burst'];

export function Wrapped(props: WrappedProps) {
  const { slides, durationInFrames } = timeline(props.data);
  return (
    <WrappedProvider value={props}>
      <AbsoluteFill style={{ background: '#0b0b0b' }}>
        <TransitionSeries>
          {slides.map((slide, i) => {
            const Slide = SLIDE_COMPONENTS[slide.id];
            return (
              <Fragment key={slide.id}>
                {i > 0 && (
                  <TransitionSeries.Transition
                    presentation={shapeWipe(SHAPES[i % SHAPES.length]!, i % 2 === 0 ? 0.4 : -0.4)}
                    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                  />
                )}
                <TransitionSeries.Sequence durationInFrames={slide.durationInFrames} name={slide.id} premountFor={20}>
                  <Slide />
                </TransitionSeries.Sequence>
              </Fragment>
            );
          })}
        </TransitionSeries>
        <Grain opacity={0.45} />
        {props.audio && (
          <Audio
            src={props.audio.src}
            trimBefore={Math.round(props.audio.startSeconds * FPS)}
            volume={(f) =>
              interpolate(f, [0, 20, durationInFrames - 45, durationInFrames], [0, 0.9, 0.9, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            }
          />
        )}
      </AbsoluteFill>
    </WrappedProvider>
  );
}

export const calculateWrappedMetadata: CalculateMetadataFunction<WrappedProps> = ({ props }) => ({
  durationInFrames: timeline(props.data).durationInFrames,
});
