# Resoniq

A community for guitarists and bassists built around the sound behind the
playing. Musicians post performances, covers, gear demos and board tours with
the exact rig attached: guitar, pickups, pedals in order, amp settings, cab.
Others can watch the take, open the signal chain, save the tone, remix it
(with credit) and compare it knob for knob. Communities, threaded
discussions, follows, a gear catalog and search sit around that core.

The original engine is still here: upload a recording and Resoniq infers a
starting-point recipe (amp, cab, pedals, EQ, gain) you can tune on a tactile
dashboard. What a player **declares** about their rig and what Resoniq's
analysis **infers** from audio are stored apart and labelled apart, everywhere.

- `docs/superpowers/specs/2026-10-22-platform-evolution-design.md`: design decisions
- `docs/design-system.md`, `docs/brand.md`: tokens, components, icons, identity
- `docs/deploy.md`: hosting requirements and credentials
- `SECURITY.md`: what's protected, how, and the known gaps

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
frontend/        Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Motion/GSAP
  app/(app)/     The signed-in app: feed, explore, search, communities, posts, profiles,
                 tones, gear, compare, composer, notifications, settings, analyze, vault
  app/admin/     The control center (staff only)
  app/api/       Route handlers: auth, social, tones, gear, media, search, admin, analysis
  lib/           Domain logic (posts, comments, tones, media, moderation, jobs, authz, …)
  worker/        Background worker: media processing (ffmpeg), purges, announcement fan-out
  prisma/        Schema, migrations, structural seed (communities, rules, gear catalog)
python-engine/   FastAPI service: feature extraction, heuristics, recipe
scripts/         smoke-test.sh, e2e-platform.sh, new-migration.sh
```

Services: **frontend** (Next), **worker** (same codebase, `tsx worker/index.ts`,
needs ffmpeg), **python-engine** (internal only), and **Postgres 16** (with
`pg_trgm`), which also holds the job queue. Files go to a private Supabase
bucket or a local volume shared by frontend and worker.

## Motion

Three rendering libraries, each with one job:

| Library | Used for |
| --- | --- |
| [Motion](https://motion.dev) (`motion/react`) | Layout and presence: signal-chain nodes, pedal reorder, pickup selector, library grid, share dialog, dropzone gestures, page entrances |
| [GSAP](https://gsap.com) | Timelines and render loops: hero waveform morph, How it works, the measurement-to-recipe reveal, measurement meters, the spectrum analyzer, EQ-curve tweening |
| [three.js](https://threejs.org) via React Three Fiber | The 3D amp head on tone pages, the analysis editor and the landing hero; loaded on demand |

All of them honor `prefers-reduced-motion`. Client state is Zustand (tool
stores, device preferences) and TanStack Query (server data that changes while
a page is open); see `docs/state-and-3d.md` for who owns what.

GSAP is free to use under its own [standard license](https://gsap.com/standard-license) (not open source).

Fonts are bundled under `frontend/public/fonts` with their SIL Open Font
License, so builds don't need to contact Google Fonts.

## Running it

### With Docker

```bash
cp .env.example .env   # set AUTH_SECRET and RESONIQ_ENGINE_SECRET
docker compose up --build
# http://localhost:3000
```

Compose runs Postgres, applies migrations and the structural seed, then
starts the engine (internal only), the worker (with ffmpeg) and the frontend.
Without Supabase settings, uploads live in the `song_data` volume shared by
the frontend and the worker.

Create the first admin (there's no UI path to it):

```bash
docker compose exec frontend true   # stack is up
docker compose run --rm migrate npx tsx scripts/grant-role.ts --email you@example.com --role ADMIN
```

### Without Docker

Requires Node 22+, Python 3.11+, libsndfile, ffmpeg/ffprobe, and Postgres 16.

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
npm run db:seed        # communities, moderation rules, gear catalog (no users or posts)
npm run dev

# worker (a third terminal): processes uploads, purges, announcements
cd frontend && npx tsx worker/index.ts

# first admin
cd frontend && npm run admin:grant -- --email you@example.com --role ADMIN
```

Sign-in: Google is the primary sign-up and sign-in method once
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set (redirect URI
`<AUTH_URL>/api/auth/callback/google`). Existing email/password accounts can
always sign in.

Email is optional: with `RESEND_API_KEY` and `RESONIQ_EMAIL_FROM` set,
verification and password-reset emails are sent and public email/password
sign-up opens. Without them in development, the links are printed to the
frontend's log; in production the flows are hidden.

Storage: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to use a
**private** Supabase bucket named `songs` (audio and media). Otherwise files
go to `frontend/.storage/`.

### Migrations

`npx prisma migrate dev --name <name>` works in a terminal. Non-interactive
environments (agents, CI) can generate the SQL with
`SHADOW_DATABASE_URL=… scripts/new-migration.sh <name>`. Search indexes are
expression indexes added by hand in the `search` migration (Prisma doesn't
model them), so keep queries in `lib/search.ts` in sync with them.

## Checks

```bash
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
TEST_DATABASE_URL=postgresql://…/resoniq_test npm run test:int   # real Postgres; name must end in _test
cd python-engine && .venv/bin/ruff check . && .venv/bin/pytest
BASE_URL=http://localhost:3000 scripts/smoke-test.sh     # analysis flow, needs the engine
BASE_URL=http://localhost:3000 scripts/e2e-platform.sh   # social + media flow, needs the worker and ffmpeg
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit and route tests,
the Postgres integration suite with a migration-drift check, the build, the
engine tests, then builds every image, starts the compose stack and runs both
end-to-end scripts against it. There's no deploy stage yet: see
`docs/deploy.md`.

## Security

See [SECURITY.md](SECURITY.md) for what's protected, how, and the known gaps.

## Not built, on purpose

- Link-based ingestion (YouTube / Spotify / SoundCloud) is a disabled
  placeholder. Pulling audio from those platforms runs into their terms of
  service and licensing, so it isn't implemented.
- Exports are Resoniq JSON only. Resoniq doesn't write Helix, Quad Cortex,
  Kemper or other proprietary preset formats.
- No fake activity: seeds create structure (communities, rules, catalog),
  never users, posts or engagement. Landing-page numbers come from the
  database, and illustrative UI is labelled "Interface preview".
