# Free-tier deployment (Vercel Hobby · Supabase Free · Render Free)

Target: $0/month, no credit card. This records what a free deployment supports
and what it doesn't, and the exact steps it takes.

## Architecture

| Piece | Where | Plan | Notes |
| --- | --- | --- | --- |
| Next.js app + API | Vercel project `resoniq` (root `frontend`, Git-connected to `main`) | Hobby | Already exists: https://resoniq-two.vercel.app |
| PostgreSQL | Supabase project `Resoniq` (us-east-1) | Free | Schema, seed and Prisma migration history applied; RLS on with no policies so the Data API can't read app tables. The older Prisma Postgres store `prisma-postgres-resoniq` is left untouched (it was never migrated) |
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

### 1. Database (Supabase; done)

The schema, structural seed and `_prisma_migrations` history are already in
the Supabase project. Vercel can't reach Supabase's IPv6-only direct host, so
set `DATABASE_URL` on Vercel (Production, Sensitive) to the **transaction
pooler** string from Supabase → Connect, with Prisma's pooler flags:

```
postgresql://postgres.<ref>:<db-password>@<pooler-host>:6543/postgres?pgbouncer=true&connection_limit=1
```

Later migrations: `PROD_DATABASE_URL='<session pooler string, port 5432>' scripts/deploy-db.sh`
(backs up first, applies pending migrations only, never resets).

### 2. Storage (Supabase)

The **private** bucket `songs` (50 MB file limit) exists. Add to the Vercel project (Production, Sensitive):
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

- **Supabase Free** gives 500 MB of database and 1 GB of storage, and pauses
  the project after a week without activity.
- **Render Free** sleeps when idle (cold start ≈ 30–60 s, inside the app's
  180 s engine timeout), has 512 MB of memory (analysis capped at 4 minutes of
  audio via `RESONIQ_MAX_AUDIO_SECONDS=240`), and 0.1 CPU, so an analysis can
  take a minute or more.
- **Vercel Hobby** functions run up to 300 s (analysis needs that), one cron
  per day, and Hobby is for non-commercial use.
- Video and audio posts need a worker, which no free tier here runs reliably.
