# State and 3D architecture

Added October 2026 (`feat/studio-state-3d`). Each kind of state has one owner.

| State | Owner | Examples |
| --- | --- | --- |
| A page's data on first render | Server Components (Prisma) | feeds, tone pages, profiles, lists |
| Server data that changes while a page is open | TanStack Query (`lib/queries/*`) | unread count, tempo ladder, gear search |
| Server writes from a control | `useMutation`, optimistic with rollback | votes, bookmarks, saves, follows, joins, ladder takes |
| One interactive tool's working copy | Zustand store per instance (`lib/stores/rig-store.ts`) | the analysis editor's amp, pickup, pedals |
| Device preferences | Zustand `persist` (`lib/stores/preferences.ts`) | metronome tempo/meter/volume, 3D on/off |
| Shareable views | URL search params | filters, sort, compare `a`/`b`, practice `tone` |
| Everything else | component state | open menus, hover, play state |

Rules that keep these from overlapping:

- **No second copy of a server list.** Infinite lists render the server's first
  page and append; they aren't mirrored into the query cache.
- **Query keys start with the user** (`["user", id, …]`), and AppShell keys the
  `QueryProvider` by user id, so a different account starts from an empty cache.
- **Mutations on one target share a `scope`**, so fast taps run in order instead
  of racing; the UI flips immediately and rolls back if the server refuses.
- **Rig stores are created per editor**, never module-global, so two editors,
  two users or two server requests can't share one. Every view of the rig (3D
  knobs, HTML knobs, EQ curve, signal chain, pedalboard, audio preview) reads
  the same store; saving reads `store.getState()`.
- **Preferences hydrate after mount** (`skipHydration`), so server HTML always
  matches, and stored values are sanitized: localStorage is user-editable.
  They hold nothing account-specific, so they're per device, not per user.

## The 3D amp

`components/three/` is an original amp head modelled from primitives: tolex
with a procedural bump map, piping, woven cloth whose tube glow follows gain,
a brushed panel with printed scales and five lathe-turned knobs. Every texture
is drawn on a canvas at runtime; there are no downloaded models or HDRs (the
reflections come from a local `Lightformer` rig), so the CSP needs no new
origins and `frame-src` is now `'none'` (the Sketchfab embed is gone).

- **Bound to real state.** On `/analyze/[id]` dragging a 3D knob writes the rig
  store; the HTML knob, EQ curve and the EQ audio preview follow, and "Save to
  vault" stores it. Tone pages show the inferred amp at its analysed settings.
  The landing hero has its own local copy with slider equivalents.
- **Enhancement only.** The HTML controls do everything the 3D does. The canvas
  is `aria-hidden`; no WebGL, a failed context, or "Hide 3D" (remembered per
  device) removes it and leaves the page whole.
- **Cheap when idle.** `frameloop="demand"`: frames render only while something
  is moving (damped knobs, glow, pointer parallax). Reduced motion turns off the
  intro sweep and parallax and snaps knobs.
- **Never in the load path.** three.js is a dynamic chunk. Pages mount it only
  when the stage is 25% on screen *and* the browser is idle; on data-saver or
  sub-4 GB devices it waits for a tap. Textures, geometries and materials are
  disposed on unmount or when replaced; R3F releases the renderer.

## Measurements

Production builds on one machine, signed out, local data. Initial JS is the
gzip size of the scripts each page's HTML loads; Lighthouse 13 mobile preset.

| Page | Initial JS `main` → branch | Lighthouse perf / LCP / TBT, `main` → branch |
| --- | --- | --- |
| `/` | 201.0 → 207.1 KB | 89 / 3.76 s / 5 ms → 92 / 3.37 s / 0 ms |
| `/t/[id]` | 197.0 → 212.3 KB | 87 / 4.09 s / 11 ms → 87 / 4.10 s / 11 ms |
| `/practice` | 192.3 → 209.1 KB | 94 / 3.07 s / 9 ms → 93 / 3.20 s / 4 ms |
| `/feed` | 196.6 → 208.9 KB | — |
| `/tones` | 190.1 → 202.1 KB | — |

- App pages carry ~12 KB for TanStack Query in the shell; tone pages another
  ~3 KB for the 3D loader. three.js (~170 KB gzip) loads only with the scene.
- The first build mounted the scene inside a 300 px pre-mount margin, which
  put three.js parsing and shader compilation into the load window: tone-page
  TBT went to 4.1 s. Mounting on visibility + idle (and dropping the
  transmission and sheen shader passes) brought it back to 11 ms.
- Lighthouse runs vary by ±0.3 s LCP locally; treat single-run LCP differences
  under that as noise.

## Limits

- Scrolling the amp into view on a slow phone still costs one long task while
  three.js parses and shaders compile; it no longer blocks loading.
- The audio preview is EQ only (bass, mids, treble, presence). Gain turns the
  knob and the tube glow but isn't audible; distorting a finished mix wouldn't
  be an honest amp preview.
- Touch: vertical drags scroll the page, so on phones knobs turn with
  horizontal drags (the HTML knobs remain the precise control).
