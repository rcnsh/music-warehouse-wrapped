// Renders one still per slide (at the moment its content has landed) to
// out/stills, for reviewing the design without playing the story.
// Usage: node scripts/stills.mjs [props.json]
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const propsPath = process.argv[2] ?? 'src/remotion/fixture.json';
const inputProps = JSON.parse(readFileSync(propsPath, 'utf8'));
const serveUrl = await bundle({ entryPoint: path.resolve('src/remotion/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Wrapped', inputProps });
const { timeline } = await import('../out/timeline.mjs');
mkdirSync('out/stills', { recursive: true });
for (const slide of timeline(inputProps.data).slides) {
  const frame = Math.min(slide.from + slide.durationInFrames - 20, slide.from + 110);
  await renderStill({ serveUrl, composition, inputProps, frame, output: `out/stills/${String(slide.from).padStart(5, '0')}-${slide.id}.png`, chromiumOptions: { gl: 'angle' } });
  console.log(slide.id, frame);
}
