import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';

/**
 * Spotify cuts each Wrapped story to a song's hook. There are no previews to
 * borrow any more (Spotify retired preview_url), so the soundtrack is a file
 * the listener picks, and this finds its hook: the stretch with the most
 * energy, decoded locally with Mediabunny.
 */

/** RMS energy is measured in windows this long. */
const WINDOW_SECONDS = 0.5;
/** How much of the song after a candidate start must be loud for it to count as the hook. */
const HOOK_SECONDS = 20;

export interface Soundtrack {
  url: string;
  name: string;
  durationSeconds: number;
  startSeconds: number;
}

export async function analyzeSoundtrack(file: File, videoSeconds: number): Promise<Soundtrack> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('That file has no audio track.');
    if (!(await track.canDecode())) throw new Error('This browser cannot decode that audio format.');
    const durationSeconds = await track.computeDuration();

    // Mean square per window, from the first channel, in one decoding pass.
    const energy: number[] = [];
    let sum = 0;
    let count = 0;
    let windowEnd = WINDOW_SECONDS;
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      const samples = buffer.getChannelData(0);
      const rate = buffer.sampleRate;
      for (let i = 0; i < samples.length; i++) {
        const t = timestamp + i / rate;
        if (t >= windowEnd) {
          energy.push(count ? sum / count : 0);
          sum = 0;
          count = 0;
          windowEnd += WINDOW_SECONDS;
        }
        const s = samples[i]!;
        sum += s * s;
        count++;
      }
    }
    if (count) energy.push(sum / count);

    return { url: URL.createObjectURL(file), name: file.name, durationSeconds, startSeconds: hookStart(energy, durationSeconds, videoSeconds) };
  } finally {
    input.dispose();
  }
}

/**
 * The start whose next HOOK_SECONDS are loudest, among starts that still
 * leave the whole video covered when the song is long enough to.
 */
export function hookStart(energy: number[], durationSeconds: number, videoSeconds: number): number {
  const hookWindows = Math.round(HOOK_SECONDS / WINDOW_SECONDS);
  const latest = Math.max(0, durationSeconds - videoSeconds);
  const lastStart = Math.min(energy.length - hookWindows, Math.floor(latest / WINDOW_SECONDS));
  if (lastStart <= 0) return 0;

  let windowSum = 0;
  for (let i = 0; i < hookWindows; i++) windowSum += energy[i] ?? 0;
  let best = 0;
  let bestSum = windowSum;
  for (let start = 1; start <= lastStart; start++) {
    windowSum += (energy[start + hookWindows - 1] ?? 0) - (energy[start - 1] ?? 0);
    if (windowSum > bestSum) {
      bestSum = windowSum;
      best = start;
    }
  }
  return best * WINDOW_SECONDS;
}
