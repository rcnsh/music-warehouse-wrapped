import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArtistImages, Wrapped, WrappedProps } from '../types';
import { FPS } from '../remotion/dimensions';
import { timeline } from '../remotion/timeline';
import { ApiError, clearConnection, fetchArtistImages, fetchPresets, fetchWrapped, getConnection, markReadOnly, normalizeUrl, setConnection, type Connection, type WrappedPreset } from './api';
import type { VideoSupport } from './exporter';
import { addDays, lastClosedDay, rangeOptions, rangeProblem } from './ranges';
import { abandonSignIn, beginSignIn, finishSignIn, signInErrorMessage, takeCallback } from './signin';
import type { Soundtrack } from './soundtrack';

// The player, the composition and the renderer are most of the app's weight;
// the connect and pick screens load without them.
const Story = lazy(() => import('./Story').then((module) => ({ default: module.Story })));
const NO_IMAGES: ArtistImages = { ids: {}, names: {} };

type Stage =
  | { kind: 'connect'; error?: string; url?: string }
  | { kind: 'signing-in'; code: string }
  | { kind: 'pick'; error?: string }
  | { kind: 'loading'; from: string; to: string }
  | { kind: 'ready'; data: Wrapped }
  | { kind: 'playing'; data: Wrapped };

export function App() {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [presets, setPresets] = useState<WrappedPreset[] | null>(null);

  // Development only: ?fixture opens the stored sample, no token or network needed.
  useEffect(() => {
    if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('fixture')) return;
    void import('../remotion/fixture.json').then((fixture) => setStage({ kind: 'ready', data: (fixture.default as unknown as WrappedProps).data }));
  }, []);
  const [artistImages, setArtistImages] = useState<ArtistImages>(NO_IMAGES);
  const [soundtrack, setSoundtrack] = useState<Soundtrack | null>(null);
  const [access, setAccess] = useState<Connection['access']>(() => getConnection()?.access ?? 'unknown');
  const abort = useRef<AbortController | null>(null);
  // Kept for signOut, which shouldn't change identity whenever the soundtrack does.
  const soundtrackRef = useRef(soundtrack);
  useEffect(() => {
    soundtrackRef.current = soundtrack;
  }, [soundtrack]);

  const connected = stage.kind !== 'connect' && stage.kind !== 'signing-in';
  useEffect(() => {
    const connection = getConnection();
    if (connection && connected) void fetchArtistImages(connection).then(setArtistImages);
  }, [connected]);

  const signOut = useCallback((error?: string) => {
    abort.current?.abort();
    clearConnection();
    if (soundtrackRef.current) URL.revokeObjectURL(soundtrackRef.current.url);
    setSoundtrack(null);
    setPresets(null);
    setArtistImages(NO_IMAGES);
    setAccess('unknown');
    setStage({ kind: 'connect', error });
  }, []);

  // Back from Spotify with a one-time code: trade it for a read token.
  const code = stage.kind === 'signing-in' ? stage.code : null;
  useEffect(() => {
    if (!code) return;
    let current = true;
    finishSignIn(code)
      .then((connection) => {
        if (!current) return;
        setConnection(connection, { persist: true });
        setAccess(connection.access);
        setStage({ kind: 'pick' });
      })
      .catch((error) => {
        if (current) setStage({ kind: 'connect', error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      current = false;
    };
  }, [code]);

  // A connection restored from this tab's storage still needs its presets.
  useEffect(() => {
    const connection = getConnection();
    if (!connection || !connected || presets) return;
    fetchPresets(connection)
      .then(setPresets)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) return signOut(TOKEN_REFUSED);
        setPresets([]);
        setStage({ kind: 'pick', error: error instanceof Error ? error.message : String(error) });
      });
  }, [connected, presets, signOut]);

  const load = useCallback(async (from: string, to: string) => {
    const connection = getConnection();
    if (!connection) return setStage({ kind: 'connect' });
    abort.current?.abort();
    // This request's own controller: by the time it settles, abort.current may be the next one's.
    const controller = new AbortController();
    abort.current = controller;
    setStage({ kind: 'loading', from, to });
    try {
      const data = await fetchWrapped(connection, from, to, controller.signal);
      setStage({ kind: 'ready', data });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) return signOut(TOKEN_REFUSED);
      if (error instanceof ApiError && error.status === 403) {
        // Only a read token is refused a range: offer just the ones it can open from now on.
        markReadOnly();
        setAccess('read');
        return setStage({ kind: 'pick', error: NOT_COMPUTED });
      }
      setStage({ kind: 'pick', error: error instanceof Error ? error.message : String(error) });
    }
  }, [signOut]);

  const props = useMemo<WrappedProps | null>(() => {
    if (stage.kind !== 'ready' && stage.kind !== 'playing') return null;
    return {
      data: stage.data,
      artistImages,
      audio: soundtrack ? { src: soundtrack.url, startSeconds: soundtrack.startSeconds } : null,
    };
  }, [stage, artistImages, soundtrack]);

  return (
    <main className="app">
      {stage.kind === 'signing-in' && (
        <section className="panel center">
          <div className="spinner" />
          <p className="hint">Signing you in…</p>
        </section>
      )}
      {stage.kind === 'connect' && (
        <Connect
          error={stage.error}
          initialUrl={stage.url}
          onConnect={(connection, ranges) => {
            setConnection(connection, { persist: false });
            setAccess(connection.access);
            setPresets(ranges);
            setStage({ kind: 'pick' });
          }}
        />
      )}
      {stage.kind === 'pick' && <Pick presets={presets} access={access} error={stage.error} onPick={load} onSignOut={() => signOut()} />}
      {stage.kind === 'loading' && (
        <section className="panel center">
          <div className="spinner" />
          <p className="hint">
            Wrapping {stage.from} → {stage.to}… a range nobody has asked for yet takes a few seconds.
          </p>
          <button type="button" className="link" onClick={() => (abort.current?.abort(), setStage({ kind: 'pick' }))}>
            Cancel
          </button>
        </section>
      )}
      {stage.kind === 'ready' && props && (
        <Ready
          props={props}
          soundtrack={soundtrack}
          onSoundtrack={setSoundtrack}
          onPlay={() => setStage({ kind: 'playing', data: stage.data })}
          onBack={() => setStage({ kind: 'pick' })}
        />
      )}
      {stage.kind === 'playing' && props && (
        <Suspense fallback={<section className="panel center"><div className="spinner" /></section>}>
          <Story
            props={props}
            onEnded={() => setStage({ kind: 'ready', data: stage.data })}
            onClose={() => setStage({ kind: 'ready', data: stage.data })}
          />
        </Suspense>
      )}
    </main>
  );
}

const TOKEN_REFUSED = 'That token was not accepted. It may have expired: sign in with Spotify again, or paste a new one.';
const NOT_COMPUTED = "The warehouse hasn't wrapped that range yet, and this token can only open ranges it has. Pick one of the ranges above.";
/** Device tokens the warehouse mints start with this; ADMIN_TOKEN and the older READ_TOKEN don't. */
const DEVICE_TOKEN_PREFIX = 'mw_';

/** Where this page load starts: a sign-in coming back, a connection already in this tab, or nothing yet. */
function initialStage(): Stage {
  const callback = takeCallback();
  if (callback?.kind === 'code') return { kind: 'signing-in', code: callback.code };
  if (callback?.kind === 'error') return { kind: 'connect', error: signInErrorMessage(callback.error), url: abandonSignIn() ?? undefined };
  return getConnection() ? { kind: 'pick' } : { kind: 'connect' };
}

function Connect({ error, initialUrl, onConnect }: {
  error?: string;
  initialUrl?: string;
  onConnect: (connection: Connection, presets: WrappedPreset[]) => void;
}) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(error);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!url.trim() || !token.trim()) return;
        setBusy(true);
        setProblem(undefined);
        try {
          const connection: Connection = { url: normalizeUrl(url), token: token.trim(), access: 'unknown' };
          onConnect(connection, await fetchPresets(connection));
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) setProblem(TOKEN_REFUSED);
          else setProblem(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="wordmark">
        Wrapped<span>.</span>
      </h1>
      <p className="lede">Your listening, any stretch of it, told the way Spotify tells it once a year.</p>
      <label className="field">
        <span>Warehouse URL</span>
        <input type="text" inputMode="url" spellCheck={false} autoComplete="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://music-warehouse.example.workers.dev" autoFocus />
      </label>
      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={async () => {
          setProblem(undefined);
          if (!url.trim()) return setProblem('Enter your warehouse URL first.');
          setBusy(true);
          try {
            location.assign(await beginSignIn(normalizeUrl(url)));
          } catch (e) {
            setProblem(e instanceof Error ? e.message : String(e));
            setBusy(false);
          }
        }}
      >
        Sign in with Spotify
      </button>
      <p className="divider">or paste a token</p>
      <label className="field">
        <span>Warehouse token</span>
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Read device token (mw_…)" />
      </label>
      {token.trim() && !token.trim().startsWith(DEVICE_TOKEN_PREFIX) && (
        <p className="hint" role="status">
          That isn't a device token. If it is the warehouse's ADMIN_TOKEN, don't use it here: it can mint and revoke tokens. Sign in with
          Spotify, or mint a read token, instead.
        </p>
      )}
      <button type="submit" disabled={busy || !token.trim()}>
        {busy ? 'Connecting…' : 'Continue with token'}
      </button>
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
      <p className="hint">
        Your browser talks to your{' '}
        <a href="https://github.com/rcnsh/music-warehouse" target="_blank" rel="noreferrer">
          music-warehouse
        </a>{' '}
        directly; nothing passes through this site. List {location.origin} in its CORS_ORIGINS. Signing in with the Spotify account that owns
        the warehouse gets a read token for 90 days, kept for this tab only. A pasted token is kept for this page only, so a reload asks
        for it again. Use a read token: never paste the admin token into a web page.
      </p>
    </form>
  );
}

function Pick({ presets, access, error, onPick, onSignOut }: {
  presets: WrappedPreset[] | null;
  access: Connection['access'];
  error?: string;
  onPick: (from: string, to: string) => void;
  onSignOut: () => void;
}) {
  const max = lastClosedDay();
  const options = useMemo(() => rangeOptions(presets, access), [presets, access]);
  const [from, setFrom] = useState(() => addDays(max, -179));
  const [to, setTo] = useState(max);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? error;
  return (
    <section className="panel">
      <h1 className="wordmark">
        Wrapped<span>.</span>
      </h1>
      <p className="lede">Pick a stretch of time.</p>
      <div className="chips">
        {options.map((p) => (
          <button key={p.label} type="button" className="chip" onClick={() => onPick(p.from, p.to)}>
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="custom"
        onSubmit={(e) => {
          e.preventDefault();
          const why = rangeProblem(from, to);
          setProblem(why);
          if (!why) onPick(from, to);
        }}
      >
        <label className="field">
          <span>From</span>
          <input type="date" value={from} max={to} min={presets?.at(-1)?.from} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={to} max={max} min={from} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <button type="submit" className="primary">
          Wrap it
        </button>
      </form>
      {access === 'read' && <p className="hint">This token opens the ranges above, and other dates only if the warehouse has already wrapped them.</p>}
      {shown && (
        <p className="error" role="alert">
          {shown}
        </p>
      )}
      <button type="button" className="link" onClick={onSignOut}>
        Use a different warehouse
      </button>
    </section>
  );
}

function Ready({ props, soundtrack, onSoundtrack, onPlay, onBack }: {
  props: WrappedProps;
  soundtrack: Soundtrack | null;
  onSoundtrack: (s: Soundtrack | null) => void;
  onPlay: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<VideoSupport | null>(null);
  const exporting = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data } = props;
  const seconds = timeline(data).durationInFrames / FPS;
  const name = `wrapped-${data.range.from}-to-${data.range.to}`;
  const muted = props.audio === null;

  // Leaving this screen stops a render in progress, rather than letting it finish and download unasked.
  useEffect(() => () => exporting.current?.abort(), []);

  // Whether this browser can encode the video at all, and in which format, before offering to.
  useEffect(() => {
    let current = true;
    setSupport(null);
    import('./exporter')
      .then((exporter) => exporter.checkVideoSupport(muted))
      .then(
        (result) => current && setSupport(result),
        (e: unknown) => current && setSupport({ ok: false, reason: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      current = false;
    };
  }, [muted]);

  const pickAudio = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy('Finding the hook…');
    try {
      const { analyzeSoundtrack } = await import('./soundtrack');
      const next = await analyzeSoundtrack(file, seconds);
      if (soundtrack) URL.revokeObjectURL(soundtrack.url);
      onSoundtrack(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const removeAudio = () => {
    if (soundtrack) URL.revokeObjectURL(soundtrack.url);
    onSoundtrack(null);
    // Otherwise choosing the same file again fires no change event.
    if (fileInput.current) fileInput.current.value = '';
  };

  const video = async () => {
    if (!support?.ok) return;
    setError(null);
    setBusy('Rendering video');
    setProgress(0);
    const controller = new AbortController();
    exporting.current = controller;
    try {
      const { download, exportVideo } = await import('./exporter');
      const blob = await exportVideo(props, support.format, setProgress, controller.signal);
      if (!controller.signal.aborted) download(blob, `${name}.${support.format.extension}`);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const card = async () => {
    setError(null);
    setBusy('Rendering card');
    try {
      const { download, exportCard } = await import('./exporter');
      download(await exportCard(props), `${name}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const top = data.top_artists[0];
  const percent = Math.round(progress * 100);
  return (
    <section className="panel">
      <h1 className="wordmark">
        Wrapped<span>.</span>
      </h1>
      <p className="lede">
        {data.range.from} → {data.range.to}
      </p>
      <dl className="facts">
        <div>
          <dt>Minutes</dt>
          <dd>{data.totals.minutes.toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt>Top artist</dt>
          <dd>{top?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Top song</dt>
          <dd>{data.top_songs[0]?.name ?? '—'}</dd>
        </div>
      </dl>
      {data.totals.plays === 0 ? (
        <p className="error">Nothing was played in this range.</p>
      ) : (
        <button type="button" className="primary big" onClick={onPlay} disabled={busy !== null}>
          Play your Wrapped
        </button>
      )}
      <label className="field file">
        <span>Soundtrack (optional)</span>
        <input ref={fileInput} type="file" accept="audio/*" onChange={(e) => void pickAudio(e.target.files?.[0])} disabled={busy !== null} />
      </label>
      {soundtrack && (
        <p className="hint">
          {soundtrack.name}: starting at {Math.floor(soundtrack.startSeconds / 60)}:{String(Math.round(soundtrack.startSeconds % 60)).padStart(2, '0')}, the loudest stretch.{' '}
          <button type="button" className="link" onClick={removeAudio}>
            Remove
          </button>
        </p>
      )}
      <div className="row">
        <button type="button" onClick={() => void video()} disabled={busy !== null || data.totals.plays === 0 || !support?.ok}>
          {support?.ok && support.format.container !== 'mp4' ? 'Download video (WebM)' : 'Download video'}
        </button>
        <button type="button" onClick={() => void card()} disabled={busy !== null || !top}>
          Download summary card
        </button>
      </div>
      {support && !support.ok && <p className="hint">Video export isn't available in this browser: {support.reason} The summary card still works.</p>}
      {busy && (
        <div className="progress">
          <span role="status">{busy}</span>
          {busy === 'Rendering video' && (
            <>
              <div className="bar" role="progressbar" aria-label="Video render progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div style={{ width: `${percent}%` }} />
              </div>
              <button type="button" className="link" onClick={() => exporting.current?.abort()}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">Video and card are made in this browser; nothing is uploaded. Keep the tab in front while it renders.</p>
      <button type="button" className="link" onClick={onBack}>
        Pick another range
      </button>
    </section>
  );
}
