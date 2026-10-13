import { fitText } from '@remotion/layout-utils';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFontsVersion, useWrapped } from '../context';
import { monthName, number } from '../format';
import { ArtCarousel, HoloDisc } from '../three/scenes';
import { DOODLES, Cutout, Doodle, Marker, Mono, PosterLines, Stack, Sticker, Tape, useEnter, useJitter } from '../ui/collage';
import { FONTS, INK, PAPER, POP } from '../theme';

export function Song() {
  const { data } = useWrapped();
  const song = data.top_songs[0]!;
  const art = song.image;
  const label = useEnter(10);
  const name = useEnter(22, 'bouncy');
  const stats = useEnter(44);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', left: 140, top: 130 }}>
        <HoloDisc art={art} size={800} speed={1.4} />
      </div>
      <Stack bottom={120} gap={26}>
        <Marker size={84} color={POP.yellow} rotate={-6} style={{ opacity: label }}>
          your top song
        </Marker>
        <div style={{ transform: `scale(${name})`, transformOrigin: 'left center' }}>
          <PosterLines text={song.name} width={920} lines={2} max={230} color={PAPER} />
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 52, color: PAPER, marginTop: 16 }}>{song.artist}</div>
        </div>
        <div style={{ opacity: stats, transform: `translateY(${(1 - stats) * 40}px)` }}>
          <Sticker color={POP.yellow} size={58} rotate={-2}>
            played {number(song.plays)} times
          </Sticker>
          <Mono size={38} color={PAPER} style={{ marginTop: 26 }}>
            It peaked in {monthName(song.peak_month)}.
          </Mono>
        </div>
      </Stack>
    </AbsoluteFill>
  );
}

export function Songs() {
  useFontsVersion();
  const { data } = useWrapped();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const songs = data.top_songs.slice(0, 5);
  const images = songs.map((s) => s.image);
  const startAt = 14;
  const holdFrames = Math.floor((durationInFrames - startAt - 20) / songs.length);
  const current = Math.min(songs.length - 1, Math.max(0, Math.floor((frame - startAt) / holdFrames)));
  const header = useEnter(0);
  return (
    <AbsoluteFill style={{ background: POP.blue }}>
      <div style={{ position: 'absolute', left: 70, top: 150, transform: `scale(${header})`, transformOrigin: 'left top' }}>
        <Marker size={64} color={PAPER} rotate={-3} style={{ marginBottom: 18 }}>
          your
        </Marker>
        <div style={{ fontFamily: FONTS.poster, fontSize: 150, color: PAPER, lineHeight: 0.9 }}>TOP SONGS</div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 330 }}>
        <ArtCarousel images={images} width={1080} height={760} holdFrames={holdFrames} startAt={startAt} />
      </div>
      {songs.map((song, i) => {
        const lit = i === current;
        const enter = ramp(frame, 20 + i * 5);
        const { fontSize } = fitText({ text: song.name.toUpperCase(), withinWidth: 700, fontFamily: FONTS.poster, validateFontIsLoaded: false });
        return (
          <div
            key={`${song.name}|${song.artist}`}
            style={{
              position: 'absolute',
              left: 70,
              top: 1140 + i * 140,
              width: 940,
              display: 'flex',
              alignItems: 'baseline',
              opacity: enter * (lit ? 1 : 0.55),
              transform: `translateX(${(1 - enter) * 300 + (lit ? 18 : 0)}px)`,
            }}
          >
            <div style={{ fontFamily: FONTS.marker, fontSize: 64, color: lit ? POP.acid : PAPER, width: 80 }}>{i + 1}</div>
            <div style={{ width: 720 }}>
              <div style={{ fontFamily: FONTS.poster, fontSize: Math.min(76, fontSize), color: PAPER, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {song.name.toUpperCase()}
              </div>
              <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: 30, color: PAPER }}>
                {song.artist} · {number(song.plays)} plays
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** A linear 0→1 ramp over 10 frames, for use inside loops where hooks can't go. */
function ramp(frame: number, delay: number): number {
  return Math.max(0, Math.min(1, (frame - delay) / 10));
}

export function Album() {
  const { data } = useWrapped();
  const album = data.top_albums[0]!;
  const art = album.image;
  const card = useEnter(0, 'bouncy');
  const text = useEnter(20);
  const jitter = useJitter('album', 1.2);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Marker size={84} rotate={-5} style={{ position: 'absolute', left: 80, top: 150 }}>
        your top album
      </Marker>
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 300,
          transform: `translate(${jitter.x}px, ${jitter.y}px) rotate(${5 + jitter.r}deg) scale(${card})`,
        }}
      >
        <Cutout src={art} size={740} border={20} />
      </div>
      <Tape x={560} y={300} rotate={4} width={300} seed="album-a" color="rgba(255, 225, 74, 0.8)" />
      <Doodle {...DOODLES.circle} x={760} y={900} width={240} height={240} stroke={10} delay={30} color={POP.red} />
      <Stack bottom={130} gap={14} style={{ opacity: text, transform: `translateY(${(1 - text) * 60}px)` }}>
        <PosterLines text={album.name} width={920} lines={2} max={200} />
        <div style={{ fontFamily: FONTS.body, fontWeight: 800, fontSize: 54, color: INK }}>{album.artist}</div>
        <Mono size={38}>
          {album.songs} songs · {number(album.minutes)} minutes
        </Mono>
      </Stack>
    </AbsoluteFill>
  );
}
