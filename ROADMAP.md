# Resoniq Roadmap

## ✅ Phase 1 — Project setup
Next.js 14 App Router + TypeScript + Tailwind, folder structure for
frontend/backend/python-engine, git initialized.

## ✅ Phase 2 — Branding
- Logo: `frontend/public/logo.svg` — an "R" built from a plucked-string
  waveform, with faint teal frequency ticks (the string vibrating).
- Design tokens: `frontend/lib/design-tokens.ts` — copper (gear/CTA) +
  signal-teal (waveform/live-data only, kept deliberately separate) on a
  blue-charcoal instrument-panel background.
- Type system: Space Grotesk (display) / Inter (body) / IBM Plex Mono
  (numeric readouts — EQ %, Hz, gain).

**Commit:** `feat: add Resoniq branding and design system`

## ✅ Phase 3 — Landing page
Full hero, features, how-it-works signal chain, example tone card, pricing,
testimonials, footer. Animated oscilloscope-trace background (signature
element). Builds clean with `next build`.

**Commit:** `feat: build premium Resoniq landing page`

## ⏳ Phase 4 — Authentication
NextAuth with email/password + Google OAuth, Prisma User model.

## ⏳ Phase 5 — Song upload system
Drag-and-drop upload UI, waveform preview (wavesurfer.js), Supabase Storage,
YouTube/Spotify/SoundCloud link ingestion.

## ⏳ Phase 6 — AI analysis engine
FastAPI service in `python-engine/`: Librosa feature extraction → heuristics
mapping → LLM-generated readable tone recipe. See README's honesty note on
what this can and can't actually claim to detect.

## ⏳ Phase 7 — Tone dashboard
Animated pedalboard signal-chain visualization, adjustable amp/pedal/effect
controls, tone match score.

## ⏳ Phase 8 — Tone library
Save/rename/favorite/search/share saved tones, Prisma schema for `Tone`.

---
Tell me which phase to build next and I'll pick up from here.
