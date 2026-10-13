import { renderMediaOnWeb, renderStillOnWeb } from '@remotion/web-renderer';
import type { WrappedProps } from '../types';
import { SUMMARY_SETTLED_FRAME } from '../remotion/Root';
import { FPS, HEIGHT, WIDTH } from '../remotion/theme';
import { timeline } from '../remotion/timeline';
import { Wrapped } from '../remotion/Wrapped';

/** A personal, non-commercial project qualifies for Remotion's free license. */
const LICENSE_KEY = 'free-license';

/**
 * Renders the story to an MP4 inside the browser: Remotion's web renderer
 * draws each frame to a canvas and Mediabunny encodes it with WebCodecs.
 * Nothing is uploaded anywhere.
 */
export async function exportVideo(props: WrappedProps, onProgress: (share: number) => void, signal: AbortSignal): Promise<Blob> {
  const { durationInFrames } = timeline(props.data);
  const result = await renderMediaOnWeb({
    composition: { id: 'Wrapped', component: Wrapped, width: WIDTH, height: HEIGHT, fps: FPS, durationInFrames, defaultProps: props },
    inputProps: props,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    videoBitrate: 'high',
    muted: props.audio === null,
    signal,
    onProgress: (progress) => onProgress(progress.progress),
    licenseKey: LICENSE_KEY,
  });
  return result.getBlob();
}

/** One frame of the story as a PNG. */
export async function exportFrame(props: WrappedProps, frame: number): Promise<Blob> {
  const { durationInFrames } = timeline(props.data);
  const result = await renderStillOnWeb({
    composition: { id: 'Wrapped', component: Wrapped, width: WIDTH, height: HEIGHT, fps: FPS, durationInFrames, defaultProps: props },
    inputProps: props,
    frame,
    licenseKey: LICENSE_KEY,
  });
  return result.blob({ format: 'png' });
}

/** The summary card as a PNG, once everything on it has landed, for sharing on its own. */
export function exportCard(props: WrappedProps): Promise<Blob> {
  const summary = timeline(props.data).slides.find((slide) => slide.id === 'summary')!;
  return exportFrame(props, summary.from + SUMMARY_SETTLED_FRAME);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
