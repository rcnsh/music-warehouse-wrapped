import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { WrappedMonth } from '../../types';
import { useArtistImage, useWrapped } from '../context';
import { dayName, monthName, number } from '../format';
import { Confetti } from '../three/scenes';
import { DOODLES, Cutout, Doodle, Marker, Mono, Poster, PosterLines, Sticker, Tape, Torn, useEnter } from '../ui/collage';
import { FONTS, INK, PAPER, POP, SPRING } from '../theme';

const countUp = (frame: number, from: number, to: number, value: number) =>
  Math.round(interpolate(frame, [from, to], [0, value], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));

export function Age() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const age = data.listening_age!;
  const head = useEnter(0);
  const note = useEnter(60, 'bouncy');
  const decades = age.decades.filter((d) => d.share >= 0.02);
  return (
    <AbsoluteFill style={{ background: POP.yellow }}>
      <div style={{ position: 'absolute', left: 80, top: 170, opacity: head, fontFamily: FONTS.body, fontWeight: 900, fontSize: 76, lineHeight: 1, color: INK }}>
        Your listening
        <br />
        age is
      </div>
      <div style={{ position: 'absolute', left: 60, top: 380 }}>
        <Poster text={String(countUp(frame, 10, 50, age.age))} width={720} max={900} />
      </div>
      <Doodle {...DOODLES.circle} x={0} y={320} width={780} height={700} stroke={1.8} delay={48} stretch />
      <div style={{ position: 'absolute', left: 80, top: 1180, transform: `scale(${note})`, transformOrigin: 'left center' }}>
        <Marker size={58} rotate={-3}>
          You played like someone who came of age
          <br />
          on music from {age.window[0]}–{age.window[1]}.
        </Marker>
      </div>
      {decades.map((decade, i) => {
        const grow = interpolate(frame - 70 - i * 6, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        const width = Math.max(320, 860 * (decade.share / Math.max(...decades.map((d) => d.share))));
        return (
          <div key={decade.decade} style={{ position: 'absolute', left: 80, top: 1430 + i * 84, width: width * grow, overflow: 'hidden' }}>
            <Torn color={INK} seed={`decade${decade.decade}`} depth={6} style={{ padding: '10px 22px', width }}>
              <Mono size={34} color={PAPER} style={{ whiteSpace: 'nowrap' }}>
                {decade.decade}s · {Math.round(decade.share * 100)}%
              </Mono>
            </Torn>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

export function Discoveries() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const top = data.discoveries.top[0];
  const image = useArtistImage(top?.name ?? '', top?.image ?? null);
  const label = useEnter(46, 'bouncy');
  const card = useEnter(70, 'bouncy');
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Marker size={80} color={PAPER} rotate={-5} style={{ position: 'absolute', left: 80, top: 160 }}>
        you discovered
      </Marker>
      <div style={{ position: 'absolute', left: 70, top: 290 }}>
        <Poster text={number(countUp(frame, 8, 46, data.discoveries.artists))} width={940} max={520} color={POP.green} />
      </div>
      <div style={{ position: 'absolute', left: 80, top: 780, transform: `scale(${label})`, transformOrigin: 'left center' }}>
        <Poster text="new artists" width={640} max={170} color={PAPER} />
        <Mono size={38} color={PAPER} style={{ marginTop: 16 }}>
          and {number(data.discoveries.songs)} songs you'd never played
        </Mono>
      </div>
      {top && (
        <div style={{ position: 'absolute', left: 80, top: 1120, display: 'flex', alignItems: 'center', transform: `translateY(${(1 - card) * 900}px)` }}>
          <Cutout src={image} size={420} border={14} rotate={-5} />
          <div style={{ marginLeft: 40, width: 460 }}>
            <Sticker color={POP.green} size={42} rotate={-4}>
              biggest find
            </Sticker>
            <div style={{ marginTop: 22 }}>
              <PosterLines text={top.name} width={460} lines={3} max={130} color={PAPER} />
            </div>
            <Mono size={32} color={PAPER} style={{ marginTop: 14 }}>
              {number(top.minutes)} minutes
            </Mono>
          </div>
        </div>
      )}
      <Tape x={130} y={1140} rotate={-40} width={180} seed="disc" />
    </AbsoluteFill>
  );
}

function MonthCard({ month, x }: { month: WrappedMonth; x: number }) {
  const art = month.image;
  return (
    <div style={{ position: 'absolute', left: x, top: 0, width: 640 }}>
      <Cutout src={art} size={640} border={16} />
      <div style={{ marginTop: 30 }}>
        <Poster text={monthName(month.month)} width={600} max={150} />
        <div style={{ fontFamily: FONTS.body, fontWeight: 800, fontSize: 46, color: INK, marginTop: 10 }}>{month.top_artist}</div>
        <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 36, color: INK }}>{month.top_song}</div>
        <Mono size={32} style={{ marginTop: 8 }}>
          {number(month.minutes)} minutes · {month.month.slice(0, 4)}
        </Mono>
      </div>
    </div>
  );
}

/** At most twelve months, evenly spread over a longer range. */
function sampleMonths(months: WrappedMonth[]): WrappedMonth[] {
  if (months.length <= 12) return months;
  return Array.from({ length: 12 }, (_, i) => months[Math.round((i * (months.length - 1)) / 11)]!);
}

/** A carousel that snaps from month to month with a springy settle. */
export function Months() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const months = sampleMonths(data.months);
  const hold = (durationInFrames - 30) / months.length;
  const index = Math.min(months.length - 1, Math.floor(Math.max(0, frame - 10) / hold));
  const since = frame - 10 - index * hold;
  const settle = index === 0 ? 1 : spring({ frame: since, fps, config: SPRING.snappy });
  const position = index - 1 + settle;
  const gap = 720;
  const header = useEnter(0);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: 'absolute', left: 80, top: 150, transform: `scale(${header})`, transformOrigin: 'left top' }}>
        <Marker size={64} rotate={-3} style={{ marginBottom: 18 }}>
          month by month
        </Marker>
        <Poster text="Your mixtape" width={760} max={160} />
      </div>
      <div style={{ position: 'absolute', left: 220 - Math.max(0, position) * gap, top: 520 }}>
        {months.map((month, i) => (
          <MonthCard key={month.month} month={month} x={i * gap} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 80, top: 1800, display: 'flex', gap: 14 }}>
        {months.map((month, i) => (
          <div key={month.month} style={{ width: 54, height: 12, background: i === index ? INK : 'rgba(11,11,11,0.2)' }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

export function Streak() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const streak = data.streak!;
  const days = countUp(frame, 8, 50, streak.days);
  const words = useEnter(30, 'bouncy');
  // One dot per day, capped so the grid fits; each dot stands for several days when it can't.
  const dots = Math.min(streak.days, 120);
  const perRow = 12;
  const lit = Math.round((days / streak.days) * dots);
  return (
    <AbsoluteFill style={{ background: POP.orange }}>
      <Confetti width={1080} height={1920} colors={[INK, PAPER, POP.yellow]} count={30} seed="streak" />
      <Marker size={80} rotate={-5} style={{ position: 'absolute', left: 80, top: 160 }}>
        your longest streak
      </Marker>
      <div style={{ position: 'absolute', left: 70, top: 280 }}>
        <Poster text={String(days)} width={700} max={700} />
      </div>
      <div style={{ position: 'absolute', left: 80, top: 900, transform: `scale(${words})`, transformOrigin: 'left center' }}>
        <Poster text="days in a row" width={900} max={200} />
        <Mono size={38} style={{ marginTop: 18 }}>
          {dayName(streak.from, true)} – {dayName(streak.to, true)}
        </Mono>
      </div>
      <div style={{ position: 'absolute', left: 80, top: 1240, width: 920, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {Array.from({ length: dots }, (_, i) => (
          <div
            key={i}
            style={{
              width: (920 - 14 * (perRow - 1)) / perRow,
              height: (920 - 14 * (perRow - 1)) / perRow / 2.2,
              borderRadius: 10,
              background: i < lit ? INK : 'rgba(11,11,11,0.15)',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/**
 * The share card: a cassette insert of the whole range. Spotify's has top
 * artists, top songs, minutes and top genre; there's no genre data here, so
 * listening age (or the top album) takes that corner.
 */
export function Summary() {
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const top = data.top_artists[0]!;
  const image = useArtistImage(top.name, top.image);
  const card = useEnter(0, 'soft');
  const reveal = (i: number) => interpolate(frame - 14 - i * 4, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const corner = data.listening_age
    ? { label: 'Listening age', value: String(data.listening_age.age) }
    : data.top_albums[0]
      ? { label: 'Top album', value: data.top_albums[0].name }
      : null;
  const title = data.range.from.slice(5) === '01-01' && data.range.to.slice(5) === '12-31' && data.range.from.slice(0, 4) === data.range.to.slice(0, 4)
    ? data.range.from.slice(0, 4)
    : `${dayName(data.range.from, true)} – ${dayName(data.range.to, true)}`;
  const list = (items: string[], offset: number) =>
    items.map((item, i) => (
      <div key={item} style={{ display: 'flex', gap: 14, opacity: reveal(offset + i), fontFamily: FONTS.body, fontWeight: 800, fontSize: 42, lineHeight: 1.3, color: INK }}>
        <span style={{ fontFamily: FONTS.mono, fontWeight: 400, fontSize: 32, width: 34, paddingTop: 5 }}>{i + 1}</span>
        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: 360 }}>{item}</span>
      </div>
    ));
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 130,
          width: 960,
          height: 1660,
          background: PAPER,
          padding: 56,
          transform: `translateY(${(1 - card) * 1900}px) rotate(${(1 - card) * 8 - 1}deg)`,
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40 }}>
          <Cutout src={image} size={420} border={12} rotate={-3} />
          <div style={{ flex: 1, paddingTop: 10 }}>
            <Mono size={28}>WRAPPED</Mono>
            <Poster text={title} width={360} max={170} />
            <Doodle {...DOODLES.star} x={720} y={300} width={110} height={110} stroke={7} delay={40} color={POP.pink} />
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 90, gap: 40 }}>
          <div style={{ width: 404 }}>
            <Mono size={28} style={{ marginBottom: 14 }}>TOP ARTISTS</Mono>
            {list(data.top_artists.slice(0, 5).map((a) => a.name), 0)}
          </div>
          <div style={{ width: 404 }}>
            <Mono size={28} style={{ marginBottom: 14 }}>TOP SONGS</Mono>
            {list(data.top_songs.slice(0, 5).map((s) => s.name), 5)}
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 110, gap: 40, opacity: reveal(11) }}>
          <div style={{ width: 404 }}>
            <Mono size={28}>MINUTES LISTENED</Mono>
            <Poster text={number(data.totals.minutes)} width={404} max={150} />
          </div>
          {corner && (
            <div style={{ width: 404 }}>
              <Mono size={28}>{corner.label.toUpperCase()}</Mono>
              <PosterLines text={corner.value} width={404} lines={2} max={150} />
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: reveal(13) }}>
          <Mono size={26}>
            {number(data.totals.artists)} ARTISTS · {number(data.totals.songs)} SONGS · {number(data.totals.days_listened)} DAYS
          </Mono>
          <Sticker color={POP.green} size={34} rotate={-3}>
            wrapped
          </Sticker>
        </div>
      </div>
    </AbsoluteFill>
  );
}
