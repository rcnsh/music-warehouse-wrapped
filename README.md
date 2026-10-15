# music-warehouse-wrapped

Spotify-Wrapped-style stories for the listening history stored by a
[music-warehouse](https://github.com/rcnsh/music-warehouse) Worker, for any
year or range, not just the one Spotify picks. Built with React and
[Remotion](https://www.remotion.dev); a story can be exported as a video or a
share card, entirely in the browser.

It is a static site. The browser calls the warehouse you name directly, so this
app holds no credentials and no data. Hosted at <https://wrapped.rcn.sh>, or run
your own.

It is one of several clients of the warehouse; the
[full list](https://github.com/rcnsh/music-warehouse#clients) is in its README.

## Requirements

A deployed music-warehouse Worker with:

- `/api/wrapped` and `/api/wrapped/ranges`.
- This app's origin in its `CORS_ORIGINS` (e.g. `https://wrapped.rcn.sh`, or
  `http://localhost:5173` for development).
- [Spotify sign-in](https://github.com/rcnsh/music-warehouse#signing-in-with-spotify),
  if you want to sign in rather than paste a token.

## Using it

1. Enter your warehouse URL.
2. **Sign in with Spotify** (the warehouse mints a 90-day read token), or paste
   a device token, `READ_TOKEN` or `ADMIN_TOKEN`. The token stays in this tab's
   session storage.
3. Pick a range. A read token opens each year and any range already wrapped;
   an admin token can wrap any range, including the rolling ones (last 30 and
   90 days).
4. Play the story, optionally with a soundtrack from a local audio file, or
   export it as a video or a card.

## Development

```bash
npm install
npm run dev          # Vite on http://localhost:5173
```

Open `http://localhost:5173/?fixture` to load the made-up sample in
`src/remotion/fixture.json` with no warehouse at all. Against a real one, run
the warehouse locally with `CORS_ORIGINS` set to `http://localhost:5173`.

| Script | |
|---|---|
| `npm run studio` | Remotion Studio, for working on slides |
| `npm run render` | Render the fixture to `out/wrapped.mp4` |
| `node scripts/stills.mjs [props.json]` | One still per slide to `out/stills` |
| `npm test` / `npm run typecheck` | Vitest / `tsc -b` |
| `npm run build && npm run deploy` | Build and deploy with `cf` (edit `domains` in `cloudflare.config.ts` first) |

`src/types.ts` mirrors the body of the warehouse's `GET /api/wrapped`; update
it when that response changes.
