import { Player, type PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WrappedProps } from '../types';
import { FPS, HEIGHT, WIDTH } from '../remotion/theme';
import { timeline } from '../remotion/timeline';
import { Wrapped } from '../remotion/Wrapped';

/** Pressing longer than this pauses instead of skipping. */
const HOLD_MS = 220;

/**
 * The story as Spotify presents it: segmented progress bars, tap the right
 * side for the next card and the left for the previous one, hold to pause.
 */
export function Story({ props, onEnded, onClose }: { props: WrappedProps; onEnded: () => void; onClose: () => void }) {
  const player = useRef<PlayerRef>(null);
  const { slides, durationInFrames } = useMemo(() => timeline(props.data), [props.data]);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const pressedAt = useRef<number | null>(null);

  useEffect(() => {
    const current = player.current;
    if (!current) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPause = () => setPaused(true);
    const onPlay = () => setPaused(false);
    current.addEventListener('frameupdate', onFrame);
    current.addEventListener('pause', onPause);
    current.addEventListener('play', onPlay);
    current.addEventListener('ended', onEnded);
    current.play();
    // Development only: lets a debugging session seek the story from the console.
    if (import.meta.env.DEV) Object.assign(window, { __story: { player: current, slides } });
    return () => {
      current.removeEventListener('frameupdate', onFrame);
      current.removeEventListener('pause', onPause);
      current.removeEventListener('play', onPlay);
      current.removeEventListener('ended', onEnded);
    };
  }, [onEnded, slides]);

  // The slide being shown is the last one to have started; a slide counts as
  // started once its entrance transition has finished.
  const index = Math.max(0, slides.findLastIndex((s) => frame >= s.from));

  const go = useCallback(
    (to: number) => {
      const target = slides[Math.max(0, Math.min(slides.length - 1, to))]!;
      player.current?.seekTo(target.from);
      player.current?.play();
    },
    [slides],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        player.current?.toggle();
      } else if (e.key === 'm') setMuted((m) => !m);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  useEffect(() => {
    if (muted) player.current?.mute();
    else player.current?.unmute();
  }, [muted]);

  const onPointerDown = () => {
    pressedAt.current = performance.now();
    player.current?.pause();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = pressedAt.current !== null && performance.now() - pressedAt.current > HOLD_MS;
    pressedAt.current = null;
    if (held) {
      player.current?.play();
      return;
    }
    const { left, width } = e.currentTarget.getBoundingClientRect();
    go(e.clientX - left < width / 3 ? index - 1 : index + 1);
  };

  return (
    <div className="story">
      <Player
        ref={player}
        component={Wrapped}
        inputProps={props}
        durationInFrames={durationInFrames}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        fps={FPS}
        style={{ width: '100%', height: '100%' }}
        acknowledgeRemotionLicense
        numberOfSharedAudioTags={2}
      />
      <div className="story-bars">
        {slides.map((slide, i) => {
          const end = slides[i + 1]?.from ?? durationInFrames;
          const fill = i < index ? 1 : i > index ? 0 : Math.min(1, (frame - slide.from) / (end - slide.from));
          return (
            <div key={slide.id} className="story-bar">
              <div style={{ width: `${Math.max(0, fill) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="story-taps" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => (pressedAt.current = null)} />
      {/* One slim row under the bars, above the slides' own top margin. */}
      <div className="story-controls">
        {props.audio && (
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}
        {paused && <span className="story-paused">Paused</span>}
        <button type="button" className="story-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
