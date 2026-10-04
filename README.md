# Resoniq

Upload a song, get back a starting-point guitar tone recipe — amp, cabinet,
pedal chain, EQ, gain, and pickup position — then tune it on an interactive
dashboard and save it to your library.

## An honest note on what the analysis is

No existing model reliably says "this is a Two-Rock amp with a Blues Driver"
from a raw recording, and Resoniq doesn't pretend to. The engine:

1. **Measures** the audio with Librosa: spectral centroid and rolloff
   (brightness), low-band energy (warmth), spectral flatness in dB over
   non-silent frames (saturation), crest factor (compression), onset attack
   and decay, harmonic/percussive balance, a rough THD estimate, reverb tail,
   and amplitude modulation.
2. **Infers** gear from those numbers with a small, transparent rules engine
   (`python-engine/app/heuristics.py`). Its thresholds are reasoned
   approximations, sanity-checked against a handful of CC-licensed
   recordings, not fit to a dataset.
3. Optionally has **Claude** turn the measurements and draft profile into
   recipe text (with `ANTHROPIC_API_KEY`); otherwise a deterministic rule-based
   recipe is used.

The UI frames every result as a closest match with a *heuristic* confidence,
not a verified rig. The guitar isn't separated from the mix first, so sparse,
guitar-forward recordings give the clearest readings. Known weak spots:
modulation detection can read a playing rhythm as tremolo, and pickup
position is a brightness guess.

## Structure

```
frontend/        Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Framer Motion
                 Pages, API routes (auth, upload, analyze, tones, audio), Prisma/Postgres
python-engine/   FastAPI service: feature extraction, heuristics, recipe
scripts/         smoke-test.sh: end-to-end API test against a running stack
```

## Studio

`/studio` is a desktop of floating windows over the same tools: a song
list, one tone dashboard per song, the library, upload, an amp & EQ lab.
Windows drag (with gentle momentum), resize from all 8 edges and corners,
stack, minimize, maximize, tile and cascade; the dock launches apps and
switches windows. The layout is saved per user (`UserWorkspace`, autosaved
after each drag or resize) and restored on load.

How it stays fast with 20+ windows:

- The Zustand store replaces only the window entries an action changes, so
  each window (subscribed to its own entry) re-renders only for its own
  changes. Tests check that untouched entries keep their identity.
- Drags and resizes write motion values (transform, width, height), not
  React state; the store gets one update when the gesture ends.
- Only the focused window uses backdrop blur. App bodies are lazy chunks.

**Spatial mode** (status bar toggle, Alt+Shift+S, saved with the layout)
adds a WebGL scene behind the windows: a shader-driven particle surface that
ripples toward the cursor and swells under open windows, lit toward the
focused one, with a parallax camera and bloom. Windows stay DOM, with depth:
the focused one comes forward and the rest recede and angle in. three.js
loads only when spatial mode is on, and bloom and resolution drop
automatically if the frame rate falls.

## Motion

Each animation library has one job, so they don't overlap:

| Library | Used for |
| --- | --- |
| [Motion](https://motion.dev) (`motion/react`) | Layout and presence: signal-chain nodes, pedal reorder, pickup selector, library grid, share dialog, dropzone gestures, page entrances |
| [GSAP](https://gsap.com) | Scroll-scrubbed timelines (hero waveform morph, How it works), the spectrum analyzer's render loop, EQ-curve tweening |
| [Anime.js](https://animejs.com) | Knob spring physics and staggered measurement lists |
| [Theatre.js](https://www.theatrejs.com) | The measurement-to-recipe reveal when an analysis lands (`lib/theatre/matcher-sequence.ts`) |
| [Animate.css](https://animate.style) | Feedback states (error shake, confirmations), importing only the keyframes used |

All of them honor `prefers-reduced-motion`. Theatre loads lazily on the
analysis page only.

Licensing: GSAP is free to use under its own
[standard license](https://gsap.com/standard-license) (not open source).
`@theatre/studio`, the visual editor for the reveal's timing, is AGPL-3.0: it
is a dev dependency, loads only in development behind `?theatre`, and isn't
in production builds. The runtime, `@theatre/core`, is Apache-2.0.

## Running it

### With Docker

```bash
cp .env.example .env   # set AUTH_SECRET and RESONIQ_ENGINE_SECRET
docker compose up --build
# http://localhost:3000
```

Compose runs Postgres, applies migrations, and starts the engine (internal
only) and the frontend. Without Supabase settings, uploads are stored in the
`song_data` volume.

### Without Docker

Requires Node 22+, Python 3.11+, libsndfile, and Postgres 16.

```bash
# python-engine
cd python-engine
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
RESONIQ_ENGINE_SECRET=<secret> .venv/bin/uvicorn main:app --port 8000

# frontend (another terminal)
cd frontend
cp .env.example .env   # DATABASE_URL, AUTH_SECRET, RESONIQ_ENGINE_SECRET=<same secret>
npm install
npx prisma migrate dev
npm run dev
```

Storage: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to use a
**private** Supabase bucket named `songs`; otherwise files go to
`frontend/.storage/`. Google sign-in appears only when `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are set.

## Checks

```bash
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd python-engine && .venv/bin/ruff check . && .venv/bin/pytest
BASE_URL=http://localhost:3000 scripts/smoke-test.sh   # against a running stack
```

CI (`.github/workflows/ci.yml`) runs all of these on every push and PR,
builds both Docker images, starts the compose stack, and runs the smoke test
against it. There's no deploy stage yet because nothing is hosted.

## Security

See [SECURITY.md](SECURITY.md) for what's protected, how, and the known gaps.

## Not built, on purpose

Link-based ingestion (YouTube / Spotify / SoundCloud) is a disabled
placeholder. Pulling audio from those platforms runs into their terms of
service and licensing, so it isn't implemented.
