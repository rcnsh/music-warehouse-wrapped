import { fitText } from '@remotion/layout-utils';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { WrappedArtist } from '../../types';
import { useArtistImage, useFontsVersion, useWrapped } from '../context';
import { number, percent } from '../format';
import { DOODLES, Cutout, Doodle, Marker, Mono, Poster, PosterLines, Sticker, Tape, useEnter, useJitter } from '../ui/collage';
import { FONTS, INK, PAPER, POP } from '../theme';

/** "YOUR TOP ARTIST" zooming in line by line until it fills the frame. */
export function ArtistTease() {
  const frame = useCurrentFrame();
  const lines = ['Your', 'top', 'artist'];
  return (
    <AbsoluteFill style={{ background: POP.pink, justifyContent: 'center' }}>
      <Doodle {...DOODLES.burst} x={780} y={190} width={220} height={220} stroke={9} delay={4} />
      <div style={{ paddingLeft: 70, marginTop: -120 }}>
        {lines.map((line, i) => {
          const zoom = interpolate(frame - i * 5, [0, 12], [2.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const shown = frame - i * 5 >= 0 ? 1 : 0;
          return (
            <div key={line} style={{ transform: `scale(${zoom})`, transformOrigin: 'left center', opacity: shown }}>
              <Poster text={line} width={940} max={420} />
            </div>
          );
        })}
      </div>
      <Marker size={96} rotate={-6} style={{ position: 'absolute', left: 640, top: 1600, opacity: frame > 30 ? 1 : 0 }}>
        was…
      </Marker>
    </AbsoluteFill>
  );
}

export function Artist() {
  const { data } = useWrapped();
  const artist = data.top_artists[0]!;
  const image = useArtistImage(artist.name, artist.image);
  const card = useEnter(0, 'bouncy');
  const name = useEnter(16, 'snappy');
  const stats = useEnter(34);
  const note = useEnter(60, 'bouncy');
  const jitter = useJitter('artist', 1.4);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 170,
          transform: `translate(${jitter.x}px, ${(1 - card) * -1200 + jitter.y}px) rotate(${-4 + jitter.r}deg)`,
        }}
      >
        <Cutout src={image} size={780} border={18} />
      </div>
      <Tape x={190} y={190} rotate={-35} seed="artist-a" />
      <Tape x={900} y={920} rotate={-30} seed="artist-b" />
      <div style={{ position: 'absolute', left: 80, top: 1040, transform: `translateX(${(1 - name) * 1100}px)` }}>
        <PosterLines text={artist.name} width={920} lines={2} max={260} color={POP.acid} />
      </div>
      <div style={{ position: 'absolute', left: 90, top: 1420, opacity: stats, transform: `translateY(${(1 - stats) * 40}px)` }}>
        <Mono size={44} color={PAPER}>
          {number(artist.minutes)} minutes
          <br />
          {percent(artist.share)} of everything you played
          <br />
          on {number(artist.days)} different days
        </Mono>
      </div>
      {artist.longest_run_days >= 3 && (
        <div style={{ position: 'absolute', left: 520, top: 1700, transform: `scale(${note})` }}>
          <Sticker color={POP.pink} size={46} rotate={4}>
            {artist.longest_run_days} days in a row
          </Sticker>
        </div>
      )}
    </AbsoluteFill>
  );
}

function ArtistRow({ artist, rank, delay }: { artist: WrappedArtist; rank: number; delay: number }) {
  useFontsVersion();
  const enter = useEnter(delay, 'snappy');
  const image = useArtistImage(artist.name, artist.image);
  const from = rank % 2 === 0 ? 1100 : -1100;
  const nameWidth = 600;
  const { fontSize } = fitText({ text: artist.name.toUpperCase(), withinWidth: nameWidth, fontFamily: FONTS.poster, validateFontIsLoaded: false });
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        top: 450 + (rank - 1) * 280,
        width: 940,
        height: 250,
        display: 'flex',
        alignItems: 'center',
        transform: `translateX(${(1 - enter) * from}px) rotate(${rank % 2 === 0 ? 1.2 : -1.2}deg)`,
      }}
    >
      <Marker size={78} rotate={-8} style={{ width: 90 }}>
        {rank}
      </Marker>
      <Cutout src={image} size={210} border={9} rotate={rank % 2 === 0 ? 3 : -3} />
      <div style={{ marginLeft: 36, width: nameWidth }}>
        <div style={{ fontFamily: FONTS.poster, fontSize: Math.min(110, fontSize), lineHeight: 0.95, color: INK, whiteSpace: 'nowrap' }}>
          {artist.name.toUpperCase()}
        </div>
        <Mono size={30}>{number(artist.minutes)} min</Mono>
      </div>
    </div>
  );
}

export function Artists() {
  const { data } = useWrapped();
  const header = useEnter(0);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: 'absolute', left: 70, top: 160, transform: `scale(${header})`, transformOrigin: 'left top' }}>
        <Marker size={64} rotate={-3} style={{ marginBottom: 18 }}>
          your
        </Marker>
        <Poster text="Top artists" width={760} max={170} />
      </div>
      <Doodle {...DOODLES.underline} x={70} y={400} width={720} height={48} stroke={10} delay={12} color={POP.pink} />
      {data.top_artists.slice(0, 5).map((artist, i) => (
        <ArtistRow key={artist.name} artist={artist} rank={i + 1} delay={12 + i * 7} />
      ))}
    </AbsoluteFill>
  );
}
