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

## Next

- Email verification and password reset (closes the signup enumeration and
  account-squatting gaps in `SECURITY.md`).
- Shared rate-limit store before running more than one instance.
- Song management: list and delete uploads (deleting a tone keeps its audio).
- Explicit share/unshare for tones instead of always-viewable-by-ID links.
- Calibrate the heuristics against a labeled set of recordings; the modulation
  detector currently mistakes playing rhythm for tremolo.
- Background job queue for analysis, so long tracks don't hold an HTTP request.
- A deploy target, then a deploy stage in CI.

## Not planned

- Link ingestion from YouTube / Spotify / SoundCloud (terms of service and
  licensing).
