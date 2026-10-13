/**
 * Serves the app and gives it a same-origin path to everything it reads.
 *
 * - /api/wrapped and /api/top go to the music-warehouse Worker over a service
 *   binding, carrying the caller's own bearer token. Nothing here holds a
 *   credential. The binding also skips the public hostname, whose WAF rule
 *   turns away any request without an Authorization header, CORS preflights
 *   included.
 *
 * Album art comes straight from Spotify's CDN, which allows any origin, so
 * canvases that draw it stay readable for the video encoder.
 */

interface Env {
  ASSETS: Fetcher;
  WAREHOUSE: Fetcher;
}

const API_PATHS = new Set(['/api/wrapped', '/api/top']);
/** Response headers worth passing back from the warehouse. */
const PASSED_HEADERS = ['content-type', 'retry-after', 'x-stats-source', 'x-stats-computed-at', 'www-authenticate'];

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const upstream = await env.WAREHOUSE.fetch(
    new Request(`https://music-warehouse${url.pathname}${url.search}`, { headers: { Authorization: authorization } }),
  );
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  for (const name of PASSED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (API_PATHS.has(url.pathname)) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
