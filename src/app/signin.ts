import { ApiError, type Connection } from './api';

/**
 * "Sign in with Spotify": the warehouse's OAuth-with-PKCE flow (RFC 7636),
 * which mints a read token for the Spotify account that owns the warehouse.
 *
 * The window goes to `<warehouse>/auth/login` and comes back here with a
 * one-time `?code=` (or `?error=`), which the browser trades for the token
 * within a minute, together with the verifier only this tab knows. The
 * warehouse URL and verifier wait in sessionStorage across the redirect.
 */

const PENDING_KEY = 'mw-wrapped:sign-in';

interface Pending {
  url: string;
  verifier: string;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 random bytes as base64url: 43 characters of A-Z a-z 0-9 - _. */
export function createVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** base64url(SHA-256(verifier)), unpadded: the S256 code_challenge. */
export async function challengeFor(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/** The sign-in page on the warehouse, which sends the browser back to `returnTo`. */
export function loginUrl(warehouse: string, options: { name: string; returnTo: string; challenge: string }): string {
  const url = new URL('/auth/login', warehouse);
  url.searchParams.set('name', options.name);
  url.searchParams.set('return_to', options.returnTo);
  url.searchParams.set('code_challenge', options.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export type Callback = { kind: 'code'; code: string } | { kind: 'error'; error: string };

/** What the warehouse put on the return URL, if anything. */
export function parseCallback(search: string): Callback | null {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  const error = params.get('error');
  if (error) return { kind: 'error', error };
  return null;
}

export function signInErrorMessage(error: string): string {
  switch (error) {
    case 'access_denied':
      return 'Sign-in was cancelled on Spotify.';
    case 'not_owner':
      return "That Spotify account doesn't own this warehouse. Sign in with the account that set it up, or paste a token.";
    case 'unavailable':
      return "The warehouse couldn't confirm your Spotify account right now. Try again in a little while.";
    case 'invalid_grant':
      return 'That sign-in expired or was already used. Try again.';
    default:
      return `Sign-in failed (${error}).`;
  }
}

/** Remembers the warehouse and a fresh verifier, and returns where to send the window. */
export async function beginSignIn(warehouse: string): Promise<string> {
  const verifier = createVerifier();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ url: warehouse, verifier } satisfies Pending));
  return loginUrl(warehouse, {
    name: `Wrapped on ${location.host}`.slice(0, 64),
    returnTo: `${location.origin}${location.pathname}`,
    challenge: await challengeFor(verifier),
  });
}

let abandoned: string | null | undefined;

/** Drops a sign-in that came back with an error, returning the warehouse it was for. */
export function abandonSignIn(): string | null {
  if (abandoned !== undefined) return abandoned;
  abandoned = pending()?.url ?? null;
  sessionStorage.removeItem(PENDING_KEY);
  return abandoned;
}

function pending(): Pending | null {
  const stored = sessionStorage.getItem(PENDING_KEY);
  return stored ? (JSON.parse(stored) as Pending) : null;
}

let callback: Callback | null | undefined;

/**
 * The callback on this page load, read once. It is stripped from the address
 * bar straight away, so a reload or a shared link doesn't replay a spent code.
 */
export function takeCallback(): Callback | null {
  if (callback !== undefined) return callback;
  callback = parseCallback(location.search);
  if (callback) {
    const url = new URL(location.href);
    for (const key of ['code', 'error', 'error_description', 'state']) url.searchParams.delete(key);
    history.replaceState(history.state, '', url);
  }
  return callback;
}

let exchange: Promise<Connection> | null = null;

/**
 * Trades the one-time code for a read token. Codes are single-use, so the
 * exchange runs once per page load however often it is asked for.
 */
export function finishSignIn(code: string): Promise<Connection> {
  exchange ??= exchangeCode(code);
  return exchange;
}

async function exchangeCode(code: string): Promise<Connection> {
  const started = pending();
  sessionStorage.removeItem(PENDING_KEY);
  if (!started) throw new Error('This tab has no sign-in in progress. Start again.');
  let response: Response;
  try {
    response = await fetch(`${started.url}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: started.verifier }),
    });
  } catch {
    throw new ApiError(0, `Couldn't reach ${started.url}. Check that the warehouse lists ${location.origin} in CORS_ORIGINS.`);
  }
  const body = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
  if (!response.ok || !body?.token) {
    throw new ApiError(response.status, signInErrorMessage(body?.error ?? 'invalid_grant'));
  }
  return { url: started.url, token: body.token };
}
