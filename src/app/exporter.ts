import { canRenderMediaOnWeb, renderMediaOnWeb, renderStillOnWeb, type WebRendererAudioCodec, type WebRendererContainer, type WebRendererVideoCodec } from '@remotion/web-renderer';
import type { WrappedProps } from '../types';
import { FPS, HEIGHT, SUMMARY_SETTLED_FRAME, WIDTH } from '../remotion/dimensions';
import { timeline } from '../remotion/timeline';
import { Wrapped } from '../remotion/Wrapped';

/*
 * Loaded on demand (see Ready in App.tsx): the web renderer, Mediabunny's
 * encoders and the whole composition are most of the app's weight, and none
 * of it is needed to connect or pick a range.
 */

/** A personal, non-commercial project qualifies for Remotion's free license. */
const LICENSE_KEY = 'free-license';

export interface VideoFormat {
  container: WebRendererContainer;
  videoCodec: WebRendererVideoCodec;
  /** Null when the export is silent. */
  audioCodec: WebRendererAudioCodec | null;
  extension: string;
}

/** Tried in order: MP4 plays everywhere, WebM is the fallback for browsers that can't encode H.264. */
const CANDIDATES: ReadonlyArray<Omit<VideoFormat, 'audioCodec'> & { audioCodec: WebRendererAudioCodec }> = [
  { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', extension: 'mp4' },
  { container: 'webm', videoCodec: 'vp9', audioCodec: 'opus', extension: 'webm' },
  { container: 'webm', videoCodec: 'vp8', audioCodec: 'opus', extension: 'webm' },
];

export type VideoSupport = { ok: true; format: VideoFormat } | { ok: false; reason: string };

/**
 * Whether this browser can export the story, and in which format. Asks
 * Remotion the same questions renderMediaOnWeb would, so a browser without
 * WebCodecs or an H.264 encoder is told so up front rather than failing
 * part-way through a render.
 */
export async function checkVideoSupport(muted: boolean): Promise<VideoSupport> {
  let reason = 'This browser cannot export video.';
  for (const candidate of CANDIDATES) {
    const result = await canRenderMediaOnWeb({
      container: candidate.container,
      videoCodec: candidate.videoCodec,
      audioCodec: muted ? null : candidate.audioCodec,
      muted,
      width: WIDTH,
      height: HEIGHT,
      videoBitrate: 'high',
    });
    if (result.canRender) {
      return { ok: true, format: { ...candidate, videoCodec: result.resolvedVideoCodec ?? candidate.videoCodec, audioCodec: muted ? null : (result.resolvedAudioCodec ?? candidate.audioCodec) } };
    }
    const first = result.issues.find((issue) => issue.severity === 'error');
    // WebCodecs or WebGL missing rules out every candidate; say that rather than the last codec tried.
    if (first && (first.type === 'webcodecs-unavailable' || first.type === 'webgl-unsupported')) return { ok: false, reason: first.message };
    if (first && reason === 'This browser cannot export video.') reason = first.message;
  }
  return { ok: false, reason };
}

/**
 * Renders the story to a video inside the browser: Remotion's web renderer
 * draws each frame to a canvas and Mediabunny encodes it with WebCodecs.
 * Nothing is uploaded anywhere.
 */
export async function exportVideo(props: WrappedProps, format: VideoFormat, onProgress: (share: number) => void, signal: AbortSignal): Promise<Blob> {
  const { durationInFrames } = timeline(props.data);
  const result = await renderMediaOnWeb({
    composition: { id: 'Wrapped', component: Wrapped, width: WIDTH, height: HEIGHT, fps: FPS, durationInFrames, defaultProps: props },
    inputProps: props,
    container: format.container,
    videoCodec: format.videoCodec,
    audioCodec: format.audioCodec,
    videoBitrate: 'high',
    muted: format.audioCodec === null,
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
