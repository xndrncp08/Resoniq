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

### Accounts, roles and live status
- Sessions are JWTs, but every authenticated request re-reads the account by
  primary key (`getActor()` in `frontend/lib/authz.ts`). A ban, suspension or
  role change applies to the next request, not when the token expires.
  Banned accounts are treated as signed out, can't sign in (credentials or
  Google), and their content disappears from every query. Suspended accounts
  can read, report and appeal, but every write route refuses them.
- Roles are `USER`, `MODERATOR` and `ADMIN`, with a static permission map
  (`frontend/lib/permissions.ts`). Every `/api/admin/*` handler and every
  moderation endpoint calls `requirePermission()`. The `/admin` pages 404 for
  anyone without staff permissions. Hiding UI is never the control.
  Moderators can suspend and remove content; only admins ban, change roles,
  edit platform config and see the audit log. Nobody can act on their own
  account, staff can only be acted on by admins, the last active admin can't
  be demoted, and the moderator who removed something can't decide its
  appeal. The first admin is created with `npm run admin:grant` on the server.
- Community moderators act only inside their community.
- **Audit log.** Every staff action (role and status changes, removals and
  restores, report dismissals, appeal decisions, rule, flag and curation
  edits, job retries, community changes) writes an `AuditLog` row in the same
  transaction as the change.
- **Email verification and password reset** (`frontend/lib/email-tokens.ts`):
  random 256-bit tokens, stored only as SHA-256 hashes, single-use (deleted
  before use, so races can't reuse them), expiring after 24 h (verify) or 1 h
  (reset). A new request invalidates older links. "Forgot password" answers
  the same whether or not the account exists. A reset bumps the account's
  `sessionVersion`, which kills every JWT issued before it. The
  `auth.requireEmailVerification` flag gates posting and community creation
  for email/password accounts.
- **Account deletion** (`DELETE /api/me`, re-entering the handle, plus the
  password for email accounts) removes everything in one transaction and
  queues storage deletes for every file the account owned.

### Authorization
- Every private API route goes through `requireActor()` / `requireUserId()`
  (`frontend/lib/authz.ts`, `frontend/lib/api.ts`); every private page goes
  through `requirePageActor()` (`frontend/lib/session.ts`).
- Visibility is part of the query, not a filter applied afterwards:
  `visiblePostWhere()` (published posts by non-banned authors, plus your own
  held or processing posts), `viewableToneWhere()` / `listedToneWhere`
  (public and unlisted tones by link, only public ones in listings, private
  ones only for their owner), and `canViewMedia()` (ready media follows its
  post's visibility).
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
| Posts / comments | user | 30 / hour, 120 / hour |
| Votes, bookmarks, saves | user | 600 / hour |
| Follows, joins | user | 120 / hour |
| Reports, appeals, gear submissions | user | 20 / hour |
| Community creation | user | 5 / day (plus: account ≥ 7 days old, ≤ 2 per 30 days) |
| Media upload start | user | 60 / hour (plus a 3 GB rolling 24 h allowance) |
| Media reads | client IP | 1200 / min |
| Public reads (feeds, profiles, search) | client IP | 240 / min |
| Verification / reset emails | user, IP and email | 5 / hour each |
| Token use (verify, reset) | client IP | 20 / 15 min |

Limited requests get `429` with `Retry-After`.

### Audio storage
- Uploaded songs live in a **private** Supabase bucket, or on local disk when
  Supabase isn't configured. They're never served by public URL: the only
  read paths are `GET /api/songs/[id]/audio` (owner only, `Cache-Control:
  no-store` so nothing stays in a shared browser's cache after sign-out) and
  the server-side analysis call.
- The public share page (`/t/[id]`) selects only the fields it renders,
  never includes the uploader's identity, email or audio, and is `noindex`.

### Media uploads (`frontend/lib/media/*`, `frontend/worker`)
- Typed by magic bytes, never by name or browser MIME (MP4/MOV, WebM/MKV,
  JPEG, PNG, WebP, MP3/WAV/FLAC/M4A). Everything else is refused, including
  GIF, HEIC and executables. The local upload route checks the first chunk
  before accepting the rest.
- Size caps are enforced three times: declared at reservation (413 before any
  bytes move), while streaming (a byte-counting transform that aborts and
  deletes the partial file), and again in the worker after download. Video is
  ≤ 500 MB and ≤ 10 min, audio ≤ 50 MB, images ≤ 15 MB and ≤ 40 MP (checked
  from probe dimensions before decoding, against decompression bombs). There
  are at most 10 attachments per post and 3 GB per user per rolling 24 h.
- ffmpeg runs in the worker only, with argument arrays (no shell), a 15-minute
  kill timer and 2 threads. Files ffmpeg can't parse fail with a user-facing
  message rather than retrying.
- Derivatives are re-encoded (H.264/AAC MP4 with faststart, JPEG/PNG for
  images) with metadata stripped, so camera and GPS data never reach other
  users. The original is deleted once processing finishes or fails.
- Storage keys are server-generated and pattern-checked
  (`media/<user>/<media>/<variant>.<ext>`). Files are served only through
  `/api/media/[id]/[variant]`, which checks visibility per request: local
  storage streams with Range support, Supabase gets a 302 to a 5-minute signed
  URL. Responses are `private`.
- Takedowns (including copyright) block access immediately. Files are
  purged by a delayed job after 30 days unless a moderator restores them on
  appeal. Account deletion queues deletes for every stored file.

### Moderation
- Automod (`frontend/lib/automod.ts`) never deletes anything. Blocked terms,
  links from accounts under 24 h old, mention floods, and N distinct reports
  put content on hold for a human. Holds are visible to the author and staff
  only.
- User text is plain text. Mentions, hashtags and links are tokenized and
  rendered as React nodes, never as HTML. Links get
  `rel="noopener noreferrer nofollow ugc"`.

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

**Rate limiting and small caches are per instance and in memory.** With N
instances the effective limit is N times higher, and restarts reset counters.
Feature flags, automod rules and landing aggregates are cached for 30–60 s per
instance. Running more than one instance needs a shared store. The client IP
comes from the rightmost `X-Forwarded-For` entry. Behind a proxy that sets
that header, that's the real client. Served directly, a client can choose its
own rate-limit key.

**Email needs a provider.** Verification and reset emails go through Resend
(`RESEND_API_KEY`, `RESONIQ_EMAIL_FROM`). Without them, production drops the
emails (logged as errors), and verification can't be enforced without locking
people out. Until a provider is configured, signup still permits
registering an address you don't own, and `/api/register` still allows
inference through the sign-in that follows. There's no MFA.

**JWT sessions are only partly revocable.** Bans, suspensions, role changes
and password resets apply immediately (live check plus `sessionVersion`).
Signing out of one device doesn't sign out others, and a stolen cookie stays
usable until it expires (30 days) or the password is reset.

**Unlisted tones are bearer links.** Anyone with an unlisted tone's ID can
view it. IDs are CUIDs: hard to guess, but not cryptographic secrets. Owners
can now make a tone private, which closes the link.

**Songs can't be deleted one by one from the UI.** They go with the account,
or when their video post's media is removed. Uploads are private either way.

**`style-src` allows `'unsafe-inline'`.** Framer Motion server-renders inline
style attributes, which nonces can't cover. Script execution is still
nonce-locked, so this allows injected CSS, not injected JavaScript.

**Media processing trusts ffmpeg.** Uploads are type-checked and capped
before decoding, but ffmpeg still parses untrusted files. Run the worker in
its own container with no secrets beyond database and storage access, as
compose does. There's no virus scanning. Moderation of images and video is
human-only (reports, holds), with no automated NSFW or copyright matching.

**The engine decodes untrusted audio** with libsndfile/audioread, and
analysis runs synchronously in the request. The size and duration caps and
per-user analyze limits bound the cost, but there's no per-engine
concurrency limit. The shared secret is static and has to be rotated by hand.

**Optional LLM step.** With `ANTHROPIC_API_KEY` set, the engine sends the
numeric audio measurements (not the audio) to Anthropic's API to write the
recipe text. Output is schema-validated and clamped, and the engine falls
back to its rule-based recipe on any error.

**Dependency advisories.** `npm audit` reports high-severity advisories in
build and dev tooling only. CI fails on any **critical** advisory in runtime
dependencies.

**Not done.** No penetration test, no secret scanning, no WAF or bot
protection beyond rate limits, and no encryption at rest beyond what the
storage provider does.
