# Resoniq

Upload a song, get back the guitar tone recipe behind it — amp, cabinet,
pedal chain, EQ, gain structure, and pickup position.

This repo is being built in phases (see `ROADMAP.md`). **Phase 1–3 are
complete**: project scaffold, brand/design system, and the full landing page.

## What's real vs. what's a placeholder right now

- ✅ Fully working Next.js landing page, brand system, animations.
- ✅ Folder structure for auth, upload, AI engine, and library — ready to fill in.
- ⏳ Not yet built: auth, upload pipeline, analysis engine, dashboard, library
  (Phases 4–8 — see `ROADMAP.md` for what's next).

## Important honesty note on the AI analysis engine

There is no existing model that reliably outputs "this is a Two-Rock amp
with a Blues Driver" from a raw recording — that specific gear-identification
capability doesn't exist as an off-the-shelf trained model. When Phase 6 is
built, the analysis engine will:

1. Extract real audio features with Librosa (spectral centroid/rolloff for
   brightness, RMS dynamics for compression, onset/attack shape, harmonic-to-
   percussive ratio, estimated THD-like distortion measures).
2. Map those features to gear categories through a heuristics/rules layer
   (e.g. high odd-harmonic content + fast attack decay → high-gain amp family).
3. Optionally pass the extracted feature summary to an LLM (Claude/OpenAI) to
   turn it into the readable "tone recipe" copy and pick illustrative
   similar-artist names.

This gives genuinely useful, consistent tone *directions* — not exact,
verified gear matches. The UI should always frame results as "closest match"
/ an inferred recipe, not a certified identification, and that framing is
part of the product's honesty, not just a legal footnote.

## Structure

```
resoniq/
  frontend/         Next.js (App Router) + TypeScript + Tailwind + Framer Motion
  backend/          Next API routes: auth, tone CRUD, calls into python-engine
  python-engine/    FastAPI microservice: Librosa/NumPy/SciPy feature extraction
```

## Running the frontend today

```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

## Environment variables (for phases 4+)

Copy `.env.example` to `.env.local` in `frontend/` once auth/DB land:

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PYTHON_ENGINE_URL=http://localhost:8000
ANTHROPIC_API_KEY=
```

See `ROADMAP.md` for what's built and what's next.
