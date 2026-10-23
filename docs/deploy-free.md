# Free-tier deployment (Vercel Hobby · Prisma Postgres Free · Supabase Free · Render Free)

Target: $0/month, no credit card. This records what a free deployment supports
and what it doesn't, and the exact steps it takes.

## Architecture

| Piece | Where | Plan | Notes |
| --- | --- | --- | --- |
| Next.js app + API | Vercel project `resoniq` (root `frontend`, Git-connected to `main`) | Hobby | Already exists: https://resoniq-two.vercel.app |
| PostgreSQL | Prisma Postgres store `prisma-postgres-resoniq` (Vercel Marketplace) | Free | Already attached: `DATABASE_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL`. Reused rather than creating a second database |
| Private file storage | Supabase project, private bucket `songs` | Free | Needed for any upload (photos, avatars, songs for analysis) |
| Analysis engine | Render web service from `render.yaml` | Free | Sleeps after 15 min idle; first request wakes it (≈30–60 s) |
| Background worker | none | — | No free always-on host. See "What runs without a worker" |

## What the code does on a host like this

- **Rate limits are shared.** On Vercel (`VERCEL` is set) budgets live in the
  `RateLimitBucket` table, one atomic upsert per check, so every function
  instance enforces the same limits. `RESONIQ_RATE_LIMIT_STORE=memory|postgres`
  overrides the default.
- **No worker → no video or audio posts.** Uploads that need ffmpeg are
  refused when the upload is reserved (503, with the reason shown in the
  composer), so nothing gets stuck "processing". Existing video and audio
  records and files are untouched, and the ffmpeg pipeline is unchanged.
  Start a worker anywhere and set `RESONIQ_MEDIA_WORKER=on` to turn them back on.
- **Photos still work.** Images are re-encoded with sharp inside the upload's
  completion request (EXIF/GPS removed, ≤ 2560 px, 40 MP decode cap).
- **Queued jobs still run.** Account deletion, media removal and announcements
  kick off a short job drain after the response (`after()`), and Vercel Cron
  runs `/api/cron/jobs` daily (Hobby allows one cron per day) for purges and
  stragglers. The cron route needs `Authorization: Bearer $CRON_SECRET`.
- **No storage → uploads off.** Without Supabase, all upload entry points
  explain that uploads aren't available yet. Text posts, communities, tones
  and rigs work.
- **Large analysis uploads go straight to storage.** Vercel caps function
  request bodies at 4.5 MB, so with Supabase the browser uploads songs
  directly to the bucket with a signed URL (`/api/upload/direct` → PUT →
  `/api/upload/complete`, which checks owner, size and magic bytes).
- **Registration stays closed until email works.** On a public deployment
  (`VERCEL`, or `RESONIQ_REQUIRE_EMAIL_FOR_SIGNUP=true`), `/signup` and
  `/api/register` stay closed until `RESEND_API_KEY` and `RESONIQ_EMAIL_FROM`
  are set. Once they are, verification is mandatory for posting and community
  creation. Existing accounts can always sign in.

## Steps

### 1. Database (Prisma Postgres; existing)

The connection strings are Sensitive in Vercel, so they can't be read back
through the CLI. Copy the **direct** `postgres://…` string from Vercel → Storage
→ `prisma-postgres-resoniq` (or the Prisma console), then:

```bash
brew install postgresql@17   # pg_dump must be ≥ the server version
PROD_DATABASE_URL='postgres://…' scripts/deploy-db.sh
```

It backs up first, refuses to drop non-empty legacy tables, applies pending
migrations (never resets), and runs the idempotent structural seed.

### 2. Storage (Supabase)

Create a free project, then a **private** bucket named `songs` with a 50 MB
file size limit. Add to the Vercel project (Production, Sensitive):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The service-role key stays
server-side. The browser only ever gets short-lived signed URLs.

### 3. Engine (Render)

Render dashboard → New → Blueprint → `xndrncp08/Resoniq` (reads `render.yaml`).
Paste `RESONIQ_ENGINE_SECRET` from `resoniq-deploy-secrets.env` (kept outside
the repository; the same value is already on Vercel). When it's live, check
`https://<service>.onrender.com/health` and set `PYTHON_ENGINE_URL` on Vercel.

### 4. Email (Resend free tier), optional but needed to open signups

Verify a sending domain, then set `RESEND_API_KEY` and `RESONIQ_EMAIL_FROM` on
Vercel. Signups open automatically, with verification required.

### 5. Deploy

Merge `chore/free-tier-deploy` into `main` and push. Vercel builds `main`
automatically. Then grant yourself admin against the production database:
`cd frontend && DATABASE_URL='postgres://…' npm run admin:grant -- --email you@… --role ADMIN`.

## Limits to know

- **Prisma Postgres Free** has a monthly operation and storage quota. Every
  API request costs a few operations, plus one for the shared rate limit.
  Watch usage in the Prisma console.
- **Render Free** sleeps when idle (cold start ≈ 30–60 s, inside the app's
  180 s engine timeout), has 512 MB of memory (analysis capped at 4 minutes of
  audio via `RESONIQ_MAX_AUDIO_SECONDS=240`), and 0.1 CPU, so an analysis can
  take a minute or more.
- **Vercel Hobby** functions run up to 300 s (analysis needs that), one cron
  per day, and Hobby is for non-commercial use.
- **Supabase Free** pauses projects after a week of inactivity and has 1 GB of
  storage.
- Video and audio posts need a worker, which no free tier here runs reliably.
