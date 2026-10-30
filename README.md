# Resoniq

**Find a sound. Make it yours. Play it forward.**

Resoniq is a place for musicians to practice, discover people, share their work, and explore the sounds behind it. It brings together a community, a tone library, browser-based audio tools, and an analysis engine that turns a recording into a starting-point rig.

[Explore Resoniq](https://resoniq-two.vercel.app) · [Run locally](#getting-started) · [Architecture](#architecture) · [Documentation](#documentation)

![Resoniq landing page, with a guitar and amplifier in a studio](docs/screenshots/home.png)

## What you can do

- **Practice with intention.** Use a metronome with tap tempo, loop and slow down a local recording, and keep a practice note in your browser. Sign in to save tempo ladders and track takes across sessions. The metronome and loop player work without an account.
- **Find your people.** Explore musician profiles by name, instrument, genre and collaboration preferences. Follow players, join communities, share posts and feedback, and start conversations.
- **Share the sound behind the playing.** Document a rig, attach tones to posts, browse the gear catalog, save and compare settings, or remix a tone with source credit. Tones can be kept private or shared.
- **Experiment in Amp Studio.** Dial in an amp, cabinet and effects, then listen to a demo, a local audio file, or live input through an audio interface. Save a sound to your account and take it into the rest of Resoniq. Studio processing is Resoniq's own approximation; it does not model a particular physical amplifier or pedal.
- **Analyze a recording.** Measure a recording and explore a suggested signal chain, settings and EQ as a starting point for your own sound. Analysis results distinguish inferred settings from a musician's declared rig.
- **Explore supported hardware.** The M-VAVE TANK-G library includes device-aware settings and setup sheets. Resoniq JSON and text setup sheets are not native M-EFCS presets; hardware and browser playback will sound different. See the [TANK-G report](docs/tank-g-library.md) for the hardware caveats.

![Resoniq practice room showing the metronome and audio loop player](docs/screenshots/practice.png)

*Screenshots show the public site captured in October 2026. Features and availability depend on the deployed version and configuration.*

## How audio analysis works

The engine uses Librosa to measure characteristics such as brightness, warmth, saturation, dynamics, attack and decay, and time-based effects. A rules engine translates those measurements into a suggested tone profile. An optional Anthropic API key enables generated recipe text; otherwise the engine uses a deterministic recipe.

These are **heuristic estimates**, not identification of the exact gear used. The engine does not separate guitar from the rest of a mix, so sparse, guitar-forward recordings generally give clearer results. Rhythmic playing can resemble tremolo, and pickup position is inferred from brightness. Longer recordings are scanned for a representative loud section; analysis works on bounded excerpts and reports the measured window. Listen, adjust, and treat the result as a starting point.

## Architecture

```text
Browser ── Next.js app and API ── PostgreSQL (application data + job queue)
                 │       │
                 │       └────── Private Supabase storage or shared local storage
                 └────────────── FastAPI analysis engine

Worker ── PostgreSQL + shared storage ── FFmpeg/ffprobe for media processing
```

| Component | Responsibility |
| --- | --- |
| `frontend/` | Next.js 16 App Router, React 19 and TypeScript UI and API routes; Auth.js authentication; Prisma data access. |
| `frontend/worker/` | Background media processing, cleanup and announcement delivery using the Postgres job queue. |
| `frontend/prisma/` | Database schema, migrations and structural seed data. |
| `python-engine/` | FastAPI service for audio feature extraction, heuristic inference and recipe generation. |
| `scripts/` | Migration, deployment and end-to-end smoke-test scripts. |
| `docs/` | Design, deployment, hardware and operational notes. |

The interface uses Tailwind CSS, Motion, GSAP and React Three Fiber; Zustand and TanStack Query manage client and server state. Fonts are bundled locally. See [state and 3D](docs/state-and-3d.md) and the [design system](docs/design-system.md) for details.

## Getting started

### Docker Compose

Requirements: Docker and Docker Compose. From the repository root:

```bash
cp .env.example .env
```

Set `AUTH_SECRET` and `RESONIQ_ENGINE_SECRET` to separate, strong values in `.env` (for example, generate each with `openssl rand -hex 32`), then run:

```bash
docker compose up --build
```

Open [localhost:3000](http://localhost:3000). Compose starts PostgreSQL, applies migrations and the structural seed, and runs the engine, frontend and worker. Local uploads use a volume shared by the frontend and worker unless Supabase is configured. To stop the services, run `docker compose down`; the named data volumes remain intact.

### Run services directly

Requirements: Node.js 22+, Python 3.11+, PostgreSQL 16 with permission to enable `pg_trgm`, libsndfile, and FFmpeg/ffprobe. Create a local PostgreSQL database and set its connection string in `frontend/.env`.

```bash
# Terminal 1: analysis engine, from the repository root
cd python-engine
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
RESONIQ_ENGINE_SECRET=your-shared-secret .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: frontend, from the repository root
cd frontend
cp .env.example .env
# Edit DATABASE_URL and AUTH_SECRET, and set RESONIQ_ENGINE_SECRET to the same value as the engine.
npm ci
npx prisma migrate dev
npm run db:seed
npm run dev
```

```bash
# Terminal 3: worker, from the repository root
cd frontend
node --env-file=.env --import tsx worker/index.ts
```

Open [localhost:3000](http://localhost:3000). The worker is needed for audio and video post processing and queued maintenance. The seed creates communities, moderation rules and gear catalog entries; it does not create users, posts or engagement.

To grant an existing account administrator access, run `npm run admin:grant -- --email you@example.com --role ADMIN` from `frontend/`. With Compose, use `docker compose run --rm migrate npx tsx scripts/grant-role.ts --email you@example.com --role ADMIN`.

### Configuration

Start with [the Compose example](.env.example), [frontend example](frontend/.env.example) and [engine example](python-engine/.env.example). Never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection for the frontend, worker and migrations. |
| `AUTH_SECRET`, `AUTH_URL` | Auth.js secret and public origin; configure the origin for deployed authentication and links. |
| `RESONIQ_ENGINE_SECRET` | Shared secret for frontend-to-engine requests; use the same value on both services. |
| `PYTHON_ENGINE_URL` | Engine address reachable by the frontend; local default is `http://localhost:8000`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Optional Google sign-in. Register `<AUTH_URL>/api/auth/callback/google` as the redirect URI. |
| `RESEND_API_KEY`, `RESONIQ_EMAIL_FROM` | Optional verification and password-reset email delivery. In development, links are logged when email is not configured; public password registration depends on email configuration. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Optional private `songs` bucket storage. Without these, non-serverless development uses local disk. |
| `ANTHROPIC_API_KEY` | Optional engine key for recipe text; the rules-based recipe works without it. |

For hosted environments, storage, worker availability, email and authentication configuration determine which features are available. See [deployment](docs/deploy.md), [free-tier deployment notes](docs/deploy-free.md), and [security](SECURITY.md); deployment reports describe their validation at the time they were written and should be rechecked before release.

## Development and checks

Run frontend checks from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Integration tests use a real PostgreSQL database and **truncate its tables**. Use a disposable database whose name ends in `_test`:

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/resoniq_test npm run test:int
```

Run engine checks from `python-engine/`:

```bash
.venv/bin/ruff check .
.venv/bin/pytest
```

From the repository root, with the appropriate services running:

```bash
BASE_URL=http://localhost:3000 scripts/smoke-test.sh
BASE_URL=http://localhost:3000 scripts/e2e-platform.sh
```

The first script exercises analysis; the second exercises social and media flows and needs the worker and FFmpeg. Playwright tests are configured in `frontend/playwright.config.ts`: start an app on port 3100, then run `npm run test:e2e` from `frontend/`, or set `E2E_BASE_URL`. The signed-in suite creates and deletes its own account, so use an appropriate test environment.

CI runs frontend lint, type checking, tests and build; PostgreSQL integration and migration-drift checks; engine lint and tests; and a Docker Compose smoke test. For schema changes, use Prisma migrations; `scripts/new-migration.sh` supports non-interactive migration generation with a shadow database. Search expression indexes are maintained in migrations and must stay in sync with `frontend/lib/search.ts`.

## Documentation

- [Deployment guide](docs/deploy.md) and [free-tier notes](docs/deploy-free.md)
- [Security model and known gaps](SECURITY.md)
- [Platform design](docs/superpowers/specs/2026-10-22-platform-evolution-design.md)
- [Design system](docs/design-system.md), [brand](docs/brand.md), and [state and 3D](docs/state-and-3d.md)
- [Managed tone publishing](docs/managed-tone-publishing.md) and [TANK-G library](docs/tank-g-library.md)
- [Roadmap](ROADMAP.md)

## Current boundaries

Link-based YouTube, Spotify and SoundCloud ingestion is a disabled placeholder. Resoniq does not export proprietary hardware preset formats. Generated tones are labeled as such, and the structural seed does not fabricate community activity. Feature flags, credentials, storage and worker configuration can further limit what a particular deployment offers.
