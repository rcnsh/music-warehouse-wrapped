import { describe, expect, it } from 'vitest';
import { challengeFor, createVerifier, loginUrl, parseCallback, signInErrorMessage } from './signin';

describe('PKCE', () => {
  it('makes verifiers RFC 7636 accepts', () => {
    const verifier = createVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(createVerifier()).not.toBe(verifier);
  });

  it('derives the S256 challenge from the RFC 7636 example', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('loginUrl', () => {
  it('points at /auth/login with every parameter encoded', () => {
    const url = new URL(loginUrl('https://warehouse.example', { name: 'Wrapped on wrapped.rcn.sh', returnTo: 'https://wrapped.rcn.sh/', challenge: 'abc' }));
    expect(url.origin + url.pathname).toBe('https://warehouse.example/auth/login');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: 'Wrapped on wrapped.rcn.sh',
      return_to: 'https://wrapped.rcn.sh/',
      code_challenge: 'abc',
      code_challenge_method: 'S256',
    });
  });
});

describe('parseCallback', () => {
  it('reads a code', () => expect(parseCallback('?code=xyz')).toEqual({ kind: 'code', code: 'xyz' }));
  it('reads an error', () => expect(parseCallback('?error=not_owner')).toEqual({ kind: 'error', error: 'not_owner' }));
  it('ignores an ordinary visit', () => {
    expect(parseCallback('')).toBeNull();
    expect(parseCallback('?fixture')).toBeNull();
  });
});

describe('signInErrorMessage', () => {
  it('explains each error the warehouse sends', () => {
    for (const error of ['access_denied', 'not_owner', 'unavailable', 'invalid_grant']) {
      expect(signInErrorMessage(error)).not.toContain(error);
    }
    expect(signInErrorMessage('weird')).toContain('weird');
  });
});
