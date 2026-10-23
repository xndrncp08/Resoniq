# Performance pass — October 2026

Shipped in `83bdb7d..34831aa` (production deploy `dpl_BaqixXoyjuaL4mexYHDNFm2iQGzq`).

## How it was measured

- **Production**: Lighthouse 12, mobile preset (simulated slow 4G, 4× CPU), one
  run per page, against https://resoniq-two.vercel.app; TTFB as the median of
  7 `curl` requests from one client (static edge assets take ~150–200 ms from
  the same client, so that much of every figure is network/TLS).
- **Server work**: the production build served locally against a load-test
  copy of the schema (5,008 users, 20,036 tones, 30,000 posts, 60,000
  comments), with PostgreSQL statement logging to count and time every query a
  page issues. `EXPLAIN (ANALYZE, BUFFERS)` on the captured SQL.
- Production data is small (62 public tones), so database wins show up locally
  at scale rather than in production timings today.

## Biggest bottlenecks found

1. Every query is a pooler round trip, serialized by `connection_limit=1`, and
   pages repeated work: the actor lookup ran ~5× per request; side-rail
   aggregates (popular gear up to 210 ms, rising musicians 29 ms) ran on every
   render.
2. Missing ordered indexes: `/tones` scanned and sorted every tone (35 ms at
   20k), the hot feed every post (24 ms at 30k).
3. Animation libraries on every page: Motion (≈43 KB gz) via the nav highlight
   and app provider, GSAP (≈58 KB gz) on every tone page via a panel only
   analysed tones render.
4. No loading boundaries on all but two routes, so navigation showed nothing
   until the full server render finished.
5. The free-tier analysis engine takes 262 s to wake, longer than its 180 s
   request timeout.

## Results

| Server work (local, 20k tones / 30k posts) | Before | After |
| --- | --- | --- |
| Signed-in `/feed` DB time | 218 ms | 8 ms |
| `/explore` DB time | 65 ms | 16 ms |
| `/tones` DB time | 21 ms | 2 ms |
| `/gear` DB time | 26 ms | 0.5 ms |
| Tone listing query (newest / most saved) | 35 ms | 0.15 / 0.17 ms |
| Hot feed query | 24 ms | 0.13 ms |

| Client JS per page (gzip, local build) | Before | After |
| --- | --- | --- |
| Tone detail | 304 KB | 197 KB |
| Feed / explore | 240 KB | ~197 KB |
| Landing | 245 KB | 201 KB |
| Plain pages (`/tones`, `/c`, `/privacy`) | 226 KB | 188 KB |

| Production Lighthouse (mobile) | Before perf / LCP / JS | After perf / LCP / JS |
| --- | --- | --- |
| `/` | 94 / 3.09 s / 219 KB | 92 / 3.13 s / 191 KB |
| `/tones` | 94 / 2.80 s / 204 KB | 96 / 2.48 s / 159 KB |
| `/gear/m-vave-tank-g` | 94 / 2.79 s / 204 KB | 98 / 2.49 s / 159 KB |
| `/t/[id]` | 94 / 3.01 s / 285 KB | 96 / 2.48 s / 166 KB |
| `/c` | 98 / 2.49 s / 202 KB | 96 / 2.42 s / 156 KB |
| `/explore` | 97 / 2.63 s / 213 KB | 96 / 2.41 s / 165 KB |
| `/privacy` | 96 / 2.64 s / 202 KB | 97 / 2.33 s / 156 KB |

Accessibility 98–100 and CLS 0.000 on every page after; SEO 100.

Production TTFB medians, before → after: `/explore` 528 → 266 ms, `/feed`
486 → 261 ms, `/compare` 339 → 263 ms, `/gear` 345 → 268 ms, `/tones`
323 → 282 ms, `/` 439 → 412 ms. Pages now stream, so first byte arrives before
the whole render completes (`/explore` completes in ~412 ms, `/feed` ~376 ms).

## Changes

- Indexes: `Tone(visibility, createdAt DESC, id DESC)`,
  `Tone(visibility, saveCount DESC, id DESC)`, `Post(hotRank DESC, id DESC)`.
- `getActor` deduplicated per render with React `cache()`.
- Popular gear (5 min), rising musicians (60 s), signed-out community
  suggestions (5 min) and the current announcement (30 s) cached per instance;
  viewer-specific filtering in JS; announcement writes clear the cache after
  commit (other instances catch up within the TTL).
- Motion removed from the shell, vote control and video preview (CSS and
  `matchMedia` instead); report dialogs load on first use; analysis-only tone
  panels split in a client module (a `next/dynamic` in a Server Component did
  not split them).
- `loading.tsx` for the app and admin shells; `htmlLimitedBots: /.*/` keeps
  metadata in `<head>` now that pages stream.
- Engine woken when `/analyze` opens (`after()`), timeout raised to 285 s inside
  the route's 300 s limit.

## Limits and trade-offs

- HTML can't be edge-cached: the per-request nonce CSP (and the session read in
  the root layout) make every page dynamic. Keeping that CSP was deliberate.
- LCP stays ~2.2–2.5 s under Lighthouse's throttled mobile profile, above the
  1.8 s goal: React's own runtime (~70 KB gz) plus Next's (~45 KB) must parse
  and hydrate on a 4× slowed CPU, and ~200 ms of TTFB is network. The landing
  page (LCP ~3.1 s) hydrates a long page; its heavy demo is already deferred.
- `connection_limit=1` still serializes a request's queries over the pooler;
  raising it would need checking against Supabase's free-tier pool.
- Auth-gated pages now stream, so a signed-out request gets 200 with an
  in-body redirect to `/login` instead of an HTTP 307. No protected content is
  rendered; APIs still return 401 and admin pages 404.
- Free-tier engine cold starts (~4.4 min) remain; warming only hides them when
  someone opens the upload page first. A keep-alive ping was not added because
  it would spend the free instance hours shared with other Render services.
- Full-text search ranks every match with `ts_rank`; on the synthetic data,
  where nearly every row matched, that took 120–290 ms. Real queries match far
  fewer rows.
