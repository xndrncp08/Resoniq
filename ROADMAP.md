# Resoniq Roadmap

## Done

1. **Project setup**: Next.js App Router + TypeScript + Tailwind, FastAPI engine.
2. **Branding**: logo, design tokens (`frontend/lib/design-tokens.ts`, the
   `@theme` block in `frontend/app/globals.css`). Copper for gear and CTAs,
   signal-teal reserved for waveform and live data. Space Grotesk / Inter /
   IBM Plex Mono via `next/font`.
3. **Landing page**: hero with the oscilloscope-trace signature, features,
   signal-chain explainer, a real (unedited) analysis result, free access.
4. **Authentication**: NextAuth v5 with email/password, and Google when
   configured.
5. **Upload**: drag-and-drop, waveform preview, private storage (Supabase or
   local disk), magic-byte type checks.
6. **Analysis engine**: Librosa features → heuristics → recipe (optionally
   written by Claude). SSRF-guarded URL fetch, shared-secret auth, size and
   duration caps.
7. **Tone dashboard**: rotary knobs, draggable pedalboard with bypass, pickup
   selector, live oscilloscope and spectrum while the source plays.
8. **Tone library**: save, search, tag filters, favorite, rename, delete,
   share links.
9. **Hardening and delivery**: rate limiting, CSP and security headers,
   ownership-scoped queries, generic errors, Vitest and pytest suites, CI with
   a Docker Compose end-to-end smoke test. See `SECURITY.md`.

10. **Community platform (Oct 2026)**: profiles and follows, communities,
    posts with video/audio/images, threaded comments, voting, bookmarks,
    mentions, hashtags, notifications, search, explore, declared rigs with
    save/remix/compare/export, a gear catalog, a media pipeline on a Postgres
    job queue and worker, reports, appeals, automod holds, and the admin
    control center with audit log, analytics and system health.
11. **Accounts**: email verification, password reset with session
    revocation, live role/status checks, account deletion.

## Next

- Configure an email provider and turn on enforced verification.
- Shared rate-limit and cache store before running more than one instance.
- HLS/adaptive video when bandwidth or mobile playback needs it (single MP4 rendition today).
- Run analysis on the job queue too, so long tracks don't hold a request.
- Blocking/muting between members; DMs are not planned yet.
- Song management: list and delete uploads (deleting a tone keeps its audio).
- Explicit share/unshare for tones instead of always-viewable-by-ID links.
- Calibrate the heuristics against a labeled set of recordings; the modulation
  detector currently mistakes playing rhythm for tremolo.
- A deploy target, then a deploy stage in CI.

## Not planned

- Link ingestion from YouTube / Spotify / SoundCloud (terms of service and
  licensing).
