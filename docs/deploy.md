# Deploying Resoniq

Nothing is hosted yet. This is what a deployment needs. Everything below is
configuration, with no code changes required.

## Components

| Service | Image / command | Needs |
| --- | --- | --- |
| Frontend | `frontend/Dockerfile` target `runner` (`node server.js`) | Postgres, storage, engine URL + secret, `AUTH_SECRET`, `AUTH_URL` |
| Worker | `frontend/Dockerfile` target `worker` (`tsx worker/index.ts`) | Postgres, the same storage as the frontend, ffmpeg (included in the image) |
| Migrations + seed | target `migrate` (one-shot, every deploy) | Postgres |
| Analysis engine | `python-engine/Dockerfile` | `RESONIQ_ENGINE_SECRET`; private network only |
| Postgres 16 | managed (Supabase, Neon, RDS, …) | the `pg_trgm` extension (the search migration creates it, so the role needs permission or it must be pre-enabled) |

Run at least one worker. Without it, uploads stay "processing", removed media
is never purged, and announcements aren't fanned out. Workers scale
horizontally: jobs are claimed with `FOR UPDATE SKIP LOCKED`.

## Storage

Use Supabase storage in production: create a **private** bucket named `songs`
and set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on the frontend and the
worker. Browsers upload media straight to the bucket with signed upload URLs
and stream playback from 5-minute signed URLs. The CSP adds the Supabase
origin automatically when `SUPABASE_URL` is set. Set the bucket's file size
limit to at least 500 MB.

> **Not verified here.** The Supabase driver for media (signed upload URL,
> stat, signed read URL) was written against the supabase-js API but not run
> against a real project; no credentials were available. Test an upload end
> to end on staging before launch (`scripts/e2e-platform.sh` covers it).

Local-disk storage (`RESONIQ_LOCAL_STORAGE_DIR`) works only when the
frontend and worker share one persistent volume on a single host.

## Required environment

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | frontend, worker, migrate | |
| `AUTH_SECRET` | frontend | `npx auth secret` |
| `AUTH_URL` | frontend | Public origin. Used for emailed links and OG images |
| `AUTH_TRUST_HOST` | frontend | `true` behind a proxy you control |
| `RESONIQ_ENGINE_SECRET` | frontend, engine | `openssl rand -hex 32`, the same on both |
| `PYTHON_ENGINE_URL` | frontend | Private address of the engine |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | frontend, worker | Storage (see above) |
| `RESEND_API_KEY`, `RESONIQ_EMAIL_FROM` | frontend | Email verification and password reset. Verify the sending domain with Resend |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | frontend | Optional |
| `ANTHROPIC_API_KEY` | engine | Optional (recipe text) |

## Launch checklist

1. Run migrations and the seed (the `migrate` target does both).
2. Grant the first admin: `npx tsx scripts/grant-role.ts --email … --role ADMIN`.
3. Configure email, then turn on **Feature flags → auth.requireEmailVerification**.
4. Review **Automod rules** (add blocked terms for your community) and **Communities**.
5. Put the app behind a proxy that sets `X-Forwarded-For` (rate limits key on it).
6. One frontend instance until rate limits move to a shared store (`SECURITY.md`).
7. Back up Postgres and the storage bucket.
8. Watch **Control center → System & jobs** for queue lag and failed jobs.
