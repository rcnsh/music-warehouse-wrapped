import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { useWrapped } from '../context';
import { dayName, hourLabel, number, persona, rangeTitle } from '../format';
import { Confetti, HoloDisc, Turntable } from '../three/scenes';
import { DOODLES, Doodle, Marker, Mono, Poster, PosterLines, Sticker, Tape, Torn, useEnter, useJitter } from '../ui/collage';
import { FONTS, INK, PAPER, POP } from '../theme';

export function Intro() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const title = rangeTitle(data.range);
  const art = data.top_songs[0]?.image ?? data.top_albums[0]?.image ?? null;
  const big = useEnter(18, 'bouncy');
  const word = useEnter(28, 'snappy');
  const jitter = useJitter('intro', 1.2);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 40, top: 180 }}>
        <HoloDisc art={art} size={1000} />
      </div>
      <Marker size={92} color={PAPER} rotate={-8} style={{ position: 'absolute', left: 90, top: 150, opacity: interpolate(frame, [6, 14], [0, 1], { extrapolateRight: 'clamp' }) }}>
        your
      </Marker>
      <Doodle {...DOODLES.star} x={860} y={170} width={130} height={130} color={POP.acid} stroke={7} delay={10} />
      <Doodle {...DOODLES.squiggle} x={70} y={1070} width={260} height={120} color={POP.pink} stroke={9} delay={24} />
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 1180,
          transform: `translate(${jitter.x}px, ${jitter.y}px) scale(${big}) rotate(${jitter.r}deg)`,
          transformOrigin: 'left bottom',
        }}
      >
        <Poster text={title.big} width={920} max={460} color={PAPER} />
      </div>
      <div style={{ position: 'absolute', left: 80, top: 1560, transform: `scale(${word})`, transformOrigin: 'left top' }}>
        <Sticker color={POP.acid} size={120} rotate={-4}>
          Wrapped
        </Sticker>
      </div>
      {title.small && (
        <Mono size={38} color={PAPER} style={{ position: 'absolute', left: 90, top: 1760, opacity: word }}>
          {title.small}
        </Mono>
      )}
      <Tape x={180} y={1190} rotate={-12} seed="intro-a" />
      <Tape x={930} y={1560} rotate={18} width={180} seed="intro-b" color="rgba(212,255,58,0.7)" />
    </AbsoluteFill>
  );
}

export function Minutes() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const title = rangeTitle(data.range);
  const count = Math.round(
    interpolate(frame, [14, 70], [0, data.totals.minutes], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }),
  );
  const intro = useEnter(4);
  const label = useEnter(70, 'bouncy');
  const footer = useEnter(96);
  const days = Math.round(data.totals.minutes / 1440);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Confetti width={1080} height={1920} colors={[POP.green, POP.pink, POP.blue, POP.yellow]} count={40} seed="minutes" />
      <div style={{ position: 'absolute', left: 0, top: 170, transform: `translateX(${(1 - intro) * -1100}px) rotate(-2deg)` }}>
        <Torn color={INK} seed="minutes-top" style={{ paddingLeft: 90, width: 980 }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 800, fontSize: 62, color: PAPER, lineHeight: 1.05 }}>
            {title.small ? 'In that time,' : `In ${title.big},`}
            <br />
            you listened for
          </div>
        </Torn>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 620 }}>
        <Poster text={number(count)} width={940} max={560} />
      </div>
      <div style={{ position: 'absolute', left: 90, top: 1150, transform: `scale(${label})`, transformOrigin: 'left center' }}>
        <Sticker color={POP.green} size={150} rotate={-4}>
          minutes
        </Sticker>
      </div>
      <div style={{ position: 'absolute', left: 60, top: 1430, width: 960, transform: `translateY(${(1 - footer) * 500}px)` }}>
        <Torn color={INK} seed="minutes-foot">
          <Mono size={38} color={PAPER}>
            {days >= 1 ? `That's ${number(days)} ${days === 1 ? 'whole day' : 'whole days'}, back to back.` : 'Every minute counted.'}
            {data.biggest_day && (
              <>
                <br />
                Your biggest day: {dayName(data.biggest_day.date)}, {number(data.biggest_day.minutes)} minutes.
              </>
            )}
          </Mono>
        </Torn>
      </div>
      <Doodle {...DOODLES.arrow} x={720} y={1300} width={150} height={150} stroke={9} delay={84} color={INK} />
    </AbsoluteFill>
  );
}

export function Clock() {
  const { data } = useWrapped();
  const { persona: who, peakHour } = persona(data.hours);
  const title = useEnter(70, 'bouncy');
  const line = useEnter(84);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Marker size={80} color={PAPER} rotate={-5} style={{ position: 'absolute', left: 90, top: 170 }}>
        your listening clock
      </Marker>
      <div style={{ position: 'absolute', left: 0, top: 300 }}>
        <Turntable hours={data.hours} peakHour={peakHour} width={1080} height={900} accent={POP.acid} base="#d8d4cb" />
      </div>
      <Mono size={30} color="#9a978f" style={{ position: 'absolute', left: 0, width: 1080, top: 1190, textAlign: 'center' }}>
        midnight at the back · the day runs clockwise
      </Mono>
      <div style={{ position: 'absolute', left: 90, top: 1300, transform: `scale(${title})`, transformOrigin: 'left center' }}>
        <Marker size={64} color={POP.acid} rotate={-3} style={{ marginBottom: 16 }}>
          you were
        </Marker>
        <PosterLines text={who.title} width={900} lines={2} max={220} color={PAPER} />
      </div>
      <div style={{ position: 'absolute', left: 90, top: 1650, width: 900, opacity: line }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 44, color: PAPER }}>{who.line}</div>
        <Mono size={34} color={POP.acid} style={{ marginTop: 14 }}>
          Peak listening around {hourLabel(peakHour)}
        </Mono>
      </div>
    </AbsoluteFill>
  );
}
