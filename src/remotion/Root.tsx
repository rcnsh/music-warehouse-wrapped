import { Composition, Freeze, Still } from 'remotion';
import type { WrappedProps } from '../types';
import fixture from './fixture.json';
import { calculateWrappedMetadata, Wrapped } from './Wrapped';
import { Summary } from './slides/later';
import { WrappedProvider } from './context';
import { FPS, HEIGHT, SUMMARY_SETTLED_FRAME, WIDTH } from './dimensions';

const defaults = fixture as unknown as WrappedProps;

export { SUMMARY_SETTLED_FRAME };

/** The summary card on its own, frozen once it has settled, for saving as an image. */
export function SummaryCard(props: WrappedProps) {
  return (
    <WrappedProvider value={props}>
      <Freeze frame={SUMMARY_SETTLED_FRAME}>
        <Summary />
      </Freeze>
    </WrappedProvider>
  );
}

/** For Remotion Studio and `remotion render`; the web app renders the same components directly. */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Wrapped"
        component={Wrapped}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={300}
        defaultProps={defaults}
        calculateMetadata={calculateWrappedMetadata}
      />
      <Still id="SummaryCard" component={SummaryCard} width={WIDTH} height={HEIGHT} defaultProps={defaults} />
    </>
  );
}
