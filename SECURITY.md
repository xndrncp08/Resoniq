# Security

This file describes what Resoniq does to protect users and the service, and,
just as importantly, what it does **not** do yet. Nothing here makes the app
"secure" in an absolute sense; it lowers specific risks and leaves others open.
The open ones are listed under [Known gaps and residual risk](#known-gaps-and-residual-risk).

## Reporting a vulnerability

Please don't open a public issue. Email the maintainer (see the GitHub
profile of the repository owner) with steps to reproduce. There is no bug
bounty.

## What is in place

### Authentication and sessions
- NextAuth v5: email/password (bcrypt, 12 rounds) and, when configured,
  Google OAuth. Sessions are signed JWTs in an HttpOnly, `SameSite=Lax`
  cookie.
- Passwords: 8 characters minimum and at most 72 bytes. bcrypt silently
  ignores bytes past 72, so longer passwords are rejected rather than
  truncated.
- Emails are normalized (trimmed, lowercased) and matched case-insensitively.
- A failed sign-in for an unknown email still runs a bcrypt comparison, so
  response time doesn't reveal whether the account exists.

### Authorization
- Every private API route goes through `requireUserId()` (`frontend/lib/api.ts`);
  every private page goes through `requirePageUserId()` (`frontend/lib/session.ts`).
- Ownership is enforced inside the database queries themselves (`findFirst`,
  `updateMany`, `deleteMany` with `userId`), not by fetching a row and
  comparing afterward. Another user's resource is indistinguishable from a
  missing one (404).
- Saving a tone only links songs the caller owns.

### Input handling
- JSON bodies are size-capped and must be `application/json`. Malformed input
  gets a 4xx, never a 500.
- Saved tone recipes are schema-validated, length-capped and clamped before
  storage (`frontend/lib/tone-validation.ts`), because they're rendered on the
  public share page.
- Uploads are typed by their magic bytes (MP3/WAV/FLAC), not by filename or
  the browser's MIME type, and capped at 50MB. Storage keys are generated
  server-side and validated against a strict pattern before they touch
  storage.

### Cross-site protections
- Content Security Policy with a per-request nonce (`frontend/proxy.ts`):
  scripts run only if Next stamped them with that request's nonce
  (`'strict-dynamic'`, no `'unsafe-inline'`, no `'unsafe-eval'` in
  production). `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`.
- Static headers on every response (`frontend/next.config.js`):
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
  `Permissions-Policy`, and `X-Frame-Options: DENY`.
- CSRF: the session cookie is `SameSite=Lax`, state-changing API requests
  with a foreign `Origin` are refused, and JSON routes require a content
  type that cross-site forms can't send. NextAuth's own routes use its CSRF
  token.
- Login `callbackUrl` only accepts same-origin paths (no open redirect).

### Rate limiting
In-memory, fixed-window, per server instance (`frontend/lib/rate-limit.ts`):

| What | Key | Limit |
| --- | --- | --- |
| `POST /api/register` | client IP | 5 / 15 min |
| Credentials sign-in | client IP, and separately the email | 10 / 15 min each |
| `POST /api/upload` | user | 10 / hour |
| `POST /api/analyze` | user | 20 / hour |
| `GET /api/tones` | user | 120 / min |
| Tone create/rename/favorite/delete | user | 60 / min |

Limited requests get `429` with `Retry-After`.

### Audio storage
- Uploaded songs live in a **private** Supabase bucket, or on local disk when
  Supabase isn't configured. They're never served by public URL: the only
  read paths are `GET /api/songs/[id]/audio` (owner only, `Cache-Control:
  no-store` so nothing stays in a shared browser's cache after sign-out) and
  the server-side analysis call.
- The public share page (`/t/[id]`) selects only the fields it renders,
  never includes the uploader's identity, email or audio, and is `noindex`.

### python-engine
- Not exposed publicly in `docker-compose.yml`, and every `/analyze*` call
  needs `X-Resoniq-Engine-Key` matching `RESONIQ_ENGINE_SECRET`
  (constant-time comparison). If the secret isn't configured, the engine
  refuses every analysis request (fails closed).
- The app sends audio bytes to `POST /analyze/file`; the engine doesn't
  fetch anything on the app's behalf.
- The URL form, `POST /analyze` with `audio_url`, is SSRF-guarded
  (`python-engine/app/fetch.py`): http(s) only, no credentials in the URL,
  every DNS answer must be a public address (rejects loopback, RFC 1918,
  link-local incl. `169.254.169.254`, CGNAT, unique-local IPv6, IPv4-mapped
  IPv6, multicast), the connection is pinned to the checked address (no DNS
  rebinding), redirects are re-validated hop by hop, and
  `RESONIQ_AUDIO_URL_ALLOWED_HOSTS` can restrict hosts further.
- Size cap (50MB) and duration cap (`RESONIQ_MAX_AUDIO_SECONDS`, default 10
  minutes). Duration is checked from the file header before decoding, and
  decoding stops one second past the cap either way.
- Clients get generic error messages; details are logged server-side only.
  No CORS: browsers have no business calling the engine.
- The container runs as a non-root user.

### Error handling
API routes are wrapped (`route()` in `frontend/lib/api.ts`): expected errors
return a deliberate message, and anything unexpected is logged with full
detail and returned as a generic 500. Engine failures are stored on the song
as a user-safe message, never the raw error.

## Known gaps and residual risk

**Rate limiting is per instance and in memory.** With N instances, the
effective limit is N times higher, and restarts reset counters. Running more
than one instance needs a shared store (Redis/Upstash/Postgres). The client
IP comes from the rightmost `X-Forwarded-For` entry. Behind a proxy that sets
or appends that header (Vercel, nginx, a load balancer) that's the real
client. Served directly with no proxy, a client can send its own header and
choose its rate-limit key.

**Account enumeration through signup isn't fully preventable without email
verification.** `/api/register` answers the same for new and existing emails,
but the automatic sign-in that follows only succeeds for a new account. The
same gap allows **account squatting**: anyone can register an email address
they don't own. Both need email verification, which needs an email provider
the project doesn't have yet. There's also no password reset and no MFA.

**Shared tone links are bearer links.** Anyone with a tone's ID can view its
recipe, signed in or not. IDs are CUIDs: hard to guess, but not
cryptographic secrets. There's no "unshare" short of deleting the tone.
Shared pages contain only the recipe and the name the owner gave it.

**Songs can't be deleted from the UI.** Deleting a tone doesn't delete the
uploaded audio. Uploads are private, but they're kept until removed by hand
from storage and the `Song` table.

**JWT sessions can't be revoked server-side.** Signing out clears the cookie
on that browser. A stolen cookie stays valid until it expires (NextAuth's
default is 30 days).

**`style-src` allows `'unsafe-inline'`.** Framer Motion server-renders inline
style attributes, which nonces can't cover. Script execution is still
nonce-locked, so this allows injected CSS, not injected JavaScript.

**The engine decodes untrusted audio** with libsndfile/audioread, and
analysis runs synchronously in the request. The size and duration caps and
per-user analyze limits bound the cost, but there's no per-engine
concurrency limit. A burst from many accounts could exhaust engine CPU.
The shared secret is static and has to be rotated by hand on both services.

**Optional LLM step.** With `ANTHROPIC_API_KEY` set, the engine sends the
numeric audio measurements (not the audio) to Anthropic's API to write the
recipe text. Output is schema-validated and clamped, and the engine falls
back to its rule-based recipe on any error.

**Dependency advisories.** `npm audit` still reports high-severity advisories
in build and dev tooling (the `braces` chain under `eslint-config-next`, and
`deepmerge-ts` under the Prisma CLI) with no non-breaking fix at the time of
writing. CI fails the build on any **critical** advisory in runtime
dependencies.

**Not done.** No penetration test, no dependency or secret scanning beyond
`npm audit`, no WAF or bot protection, no audit log, and no encryption at
rest beyond what the storage provider does.
