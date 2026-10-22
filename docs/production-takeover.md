# Production takeover — 22 October 2026

Status: substantially hardened and locally validated; staging acceptance is still required before a public launch.

## Verified starting point

The repository is the nested `Resoniq/` directory in the workspace. The starting working tree was clean. All eight reported phase branches exist. Both `integration/platform-evolution` and `chore/platform-hardening` resolve to `90f8a86469a0d2fcfc9c3057edf640f628ec1af4`. Work continued from that commit on `chore/production-takeover`; phase branches and `main` were preserved.

The platform is implemented, not a scaffold: Next.js App Router, Auth.js credentials/optional Google authentication, Prisma/PostgreSQL, a PostgreSQL job worker, local/private Supabase storage drivers, FFmpeg processing, and a separate FastAPI/librosa analysis engine. The tree contains 48 page entry points, 13 migrations, a 137-item gear catalog, custom musician icons, and the original Dial Q brand family.

Inspection covered the specifications and plans, deploy/security/brand documentation, authentication and API guards, visibility queries, social services, administrative mutations, media/storage/worker code, migrations, CI and Docker configuration, and the existing test suites. This was a targeted code and runtime audit across the platform, not a formal penetration test or proof that every branch of every file is correct.

The existing feed/application homepage was retained. Its only page-specific change is an accessible, visually hidden heading. Shared accessibility and motion-loading changes also apply to it.

## Findings and fixes

| Finding | Change and evidence |
| --- | --- |
| Installed Next.js 16.3.8 was affected by current critical advisories | Pinned Next.js and its ESLint config to 16.4.2; installed Sharp 0.35.5. Updated source-map-js and overrode Prisma's deepmerge-ts dependency to 8.0.0 without a Prisma major migration. Runtime audit is clear. |
| Distinct rate-limit keys could grow past the nominal 10,000-key cap | Refuse new keys at capacity without evicting live budgets; recover after expiry. Regression test covers saturation and recovery. |
| JSON limits ran after `req.text()` had buffered the entire request | Read and cap streamed bytes, cancel oversized bodies, and accept only the exact JSON media type. Tests cover false content lengths and stream cancellation. |
| CSRF comparison could use forwarded host input rather than the public origin | Prefer the configured `AUTH_URL`/`NEXTAUTH_URL` origin. Test rejects forged forwarded headers. |
| The administrator signup switch was not enforced by credential registration | Registration now checks `signups` before creating an account. Route test covers the disabled state. |
| A login racing a password reset could stamp an old password with the new session version | Credentials carry the version read with their password hash into JWT creation. Dedicated callback test covers the race. |
| Token consumption and the associated account update were separate commits | Verification and reset consume/update atomically. PostgreSQL tests cover expiry, replay, concurrent use, verification gating and session version changes. |
| Concurrent completion requests could queue duplicate transcodes | Conditional UPLOADING → PROCESSING transition and enqueue in one transaction. Five concurrent completions produce one job. |
| A transcode could overwrite a concurrent media removal | Conditional final transaction preserves removal/deletion, cleans completed output when publication loses the race, and creates extracted songs only on successful settlement. A removal-during-processing test covers it. |
| A post attached after a worker started could remain processing | Settlement uses the current attachment relation; attachment writes also check their current state. PostgreSQL/FFmpeg regression covers the late attachment. |
| Long media jobs could be reclaimed while still running | Heartbeat active job leases; completion/failure updates require the claiming worker. Test covers renewal and stale-worker updates. This remains an at-least-once queue, not an exactly-once execution guarantee. |
| FFmpeg could use protocols unnecessary for local uploaded files | Limit FFmpeg/FFprobe to file/pipe protocols. Real transcoding tests still pass. |
| A media response could remain in browser cache after access changed | Access-checked media and signed-URL redirects use `private, no-store`; the HTTP platform test asserts the header. Already issued Supabase links retain their expiry window. |
| Account deletion cascaded through other members' replies and left social counters behind | Detach surviving replies and repair their depths, counts, votes, bookmarks, ranking, reputation contributions, memberships and tone counters transactionally. Delete account tokens and queue originals as well as known derivatives. Regression uses real related rows. |
| Concurrent staff demotions could defeat the last-admin count | Serialize admin changes with row locks; also protect the last active admin from status changes and account deletion. Expired suspensions no longer unnecessarily block the console. Tests cover the guards. |
| An expired failed aggregate request could evict a newer cached value | Delete only the failed promise's own cache entry. Unit test covers overlapping loads. |
| Refreshed discovery aggregates included banned authors' content | Filter banned authors from trending tags and public counts; integration coverage verifies refreshed results. Aggregates may still be stale for their documented 60-second TTL. |
| Dialog focus reset on callback changes; textareas were absent from the trap | Stable close effect, textarea-aware/disabled-aware focus order, scroll lock and restoration. Browser assertions verify typing, Tab, Escape and restored focus. |
| Video shortcuts intercepted nested form controls and hover previews ignored reduced motion | Skip shortcuts originating in controls and disable automatic previews under reduced motion. |

## Visual delivery and branding

Three original, generated photographic compositions are integrated into the public landing page: a black guitar with tube amp/cabinet, a performing bassist beside studio equipment, and a copper/teal/cream pedalboard. These are generated studio imagery, not documentary photographs or renders of the licensed Sketchfab model.

Seven optimized local WebP files live in `frontend/public/images/` (about 708 KiB total). `next/image` supplies responsive delivery, reserved dimensions, hero preload and lazy loading below the fold. A new 1200×630 JPEG social preview combines the studio photograph with the existing original wordmark; regenerate it with `cd frontend && node scripts/brand-social.mjs`. That script asserts the output dimensions.

The old decorative guitar/amp/pedal SVG components and their imports were removed. Functional icons, technical visualizations, charts and logos were retained. The moving GearWall is now an eight-item static grid with a catalog link; duplicate marquee links and float/marquee keyframes were removed. GSAP and Motion remain installed because working analysis/app controls still use them.

The original Dial Q mark, custom wordmark, favicon, light/dark wordmark variants, app icons and musician icon family were evaluated and retained. The established charcoal/copper/teal tokens now carry the photographic presentation across the landing and shared UI. Touch targets, mobile input sizes, focus outlines, modal safe areas and scrolling were improved centrally.

Canva search found no existing Resoniq designs. Its brand exploration tool returned an empty recommendation, not an editable design. No Canva file or Figma file was created, and no Figma connector was available. The actual delivered brand assets are in this repository.

## Exact Sketchfab guitar

The public API and oEmbed endpoint were checked for model `9cfa538c43404968bed2b0c023393357`, **3D Guitar - Black Strat** by **Viva_1**. `isDownloadable` is false and the returned license object is empty; there is no established permission to download or redistribute a local GLB. The implementation therefore uses the official authorized iframe, with creator credit and a link to the original.

The exact model rendered in browser validation (`output/playwright/guitar-viewer-mobile.png`). The showcase uses an immediate photographic cover and an explicit load button, a fixed layout, no automatic spin or animation playback, a requested 1024 texture cap, dark framing, and a persistent close/original-model link. The iframe is destroyed when closed, offscreen, hidden or unmounted. No Sketchfab network resources load before activation. Only Sketchfab is added to `frame-src`; the script nonce policy is retained. Rendering, lighting and camera limits inside the viewer remain controlled by Sketchfab/the model creator. Sensor/XR permission warnings from the viewer were observed; the app does not grant those unnecessary permissions.

Sources: [model](https://sketchfab.com/3d-models/3d-guitar-black-strat-9cfa538c43404968bed2b0c023393357), [public metadata](https://api.sketchfab.com/v3/models/9cfa538c43404968bed2b0c023393357), [embedding documentation](https://sketchfab.com/developers/oembed), [Sketchfab terms](https://sketchfab.com/terms).

## Validation and measurements

| Check | Actual result |
| --- | --- |
| Baseline frontend | 199 tests passed; lint passed |
| Final frontend | 210 tests passed in 20 files; lint passed |
| PostgreSQL integration | 64 tests in 12 files, including actual FFmpeg derivatives, concurrent writes, visibility, roles, audit logs, reports/appeals, email-token behavior and deletion |
| Python engine | 61 tests passed; three upstream Python audio-module deprecation warnings |
| Production build | `npm run build` completed with exit 0 on Next.js 16.4.2; TypeScript completed |
| Clean dependency installation | Fresh `npm ci` and Prisma generation completed in an isolated temporary directory |
| Migration replay/drift | All 13 migrations applied to a new disposable database; separate shadow-database diff returned “No difference detected” and exit 0 |
| Platform HTTP test | Passed against the production server and worker: register/login, profiles, follows, public declared tone, generated video upload, bad-file rejection, publication, range playback, comments/replies/votes/bookmarks, saves/remixes, notifications, search, reporting, denied moderation/admin access and account deletion |
| Analysis smoke test | Passed against the real Python engine: register/login → WAV upload → analysis → private owner-only audio → tone save/search/favorite/rename/share/delete |
| Standalone runner | Copied `public` and `.next/static` as in the Dockerfile, ran `.next/standalone/server.js`, and passed runtime checks |
| Browser | Signup and publishing passed through the UI; dialog keyboard checks passed; exact 3D model rendered |
| Responsive | Ten routes checked at 390×844, 834×1112 and 1440×1000: no document overflow. Feed, community list, gear, tones, profile, tone detail, admin, settings, login and signup returned 200 |
| Runtime dependency audit | `npm audit --omit=dev`: zero advisories |
| Complete dependency audit | Six high findings remain in development tooling (ESLint glob dependencies and Vite). A patch update attempt hit npm's `edgesOut` error; the known-working lockfile and reproducible clean install were preserved. No force/major downgrade was applied |

Dependency references: [Next.js image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [deepmerge-ts advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). The Prisma transitive override should be removed when a compatible Prisma release incorporates the fixed dependency.

The PostgreSQL integration database is `resoniq_test`. HTTP/browser work used the newly created `resoniq_takeover_e2e_test`, and migration drift used `resoniq_takeover_shadow_test`. The development `resoniq` database was never reset, migrated, seeded or written by this work. Its observed counts remained 17 users, 0 posts and 137 gear entries. The existing pre-platform backup was inspected with `pg_restore --list`, not restored.

Mobile Lighthouse used local Chrome and the production server, with the viewer inactive. These are lab measurements, not field Core Web Vitals or a load test:

| Metric | Initial photographic implementation | Optimized implementation |
| --- | ---: | ---: |
| Performance | 86 | 90 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| Simulated LCP | 4.3 s | 3.6 s |
| Total blocking time | 10 ms | 0 ms |
| Cumulative layout shift | 0 | 0 |
| Transfer size | 535 KiB | approximately 465 KiB |

The detailed amp/EQ example now loads on request; the public page no longer eagerly loads the global motion provider, and the technical process diagram is static. The initial gear query is capped at 8 rows rather than 60. LCP is still above the 2.5-second “good” target under simulated mobile throttling. There is no claim of good field CWV or production-scale database latency.

Browser screenshots, Lighthouse HTML/JSON, and the responsive check output are local evidence under `output/playwright/` (ignored by Git). Test logs were captured in `/tmp/resoniq-*.log`. The desktop/tab/device matrix did not include real iOS Safari, low-power devices or assistive-technology testing. Guidelines were reviewed from [Vercel's official source](https://vercel.com/design/guidelines) and its official web-design-guidelines skill.

## Launch gates and remaining limitations

1. **Provider acceptance:** no configured Supabase service-role key, Resend sending credentials, Google OAuth credentials or Anthropic key. The Supabase connector exposes a generically named project, but it is not configured/identified as Resoniq's storage target. No remote bucket, provider delivery or live OAuth success is claimed. Test private storage, signed upload/read URLs, expiry, metadata stripping and failures on the intended staging project; test actual verification/reset delivery and Google login there.
2. **Docker:** the executable is absent. Images, Compose startup, Linux native-library behavior, image health checks and container volume permissions have not been exercised locally. Local PostgreSQL, FFmpeg, engine, worker and standalone frontend provide partial supported alternatives. The existing CI stack job still needs to run on these commits.
3. **Single frontend instance:** rate limits remain bounded but process-local and reset on restart. A trusted reverse proxy must overwrite client IP headers. Multiple instances/serverless deployments need shared limits before public use. Flag/rule caches are per instance with 30-second TTLs; aggregate caches use 60 seconds. Status/role/session authorization is read from the database and is not served from these caches.
4. **Media/storage:** Supabase downloads/uploads currently buffer objects; provision memory for large files and validate peak RSS before using the 500 MB video limit. A previously issued signed URL can remain usable for up to five minutes. FFmpeg is not a sandbox or virus scanner. Exhaustive crash/retry/delete/restore race and orphan-object reconciliation testing remains open, including purge versus appeal restore and partial provider failures.
5. **Retention and load:** historical counter drift from earlier deletions was not rewritten in development data. Large-account deletion, deep pagination, production-volume search/feed plans, DB connection budgets, worker saturation and engine concurrency/load still need staging tests. No new destructive migration or data backfill was added. A historical migration drops the removed Studio `UserWorkspace` table; do not replay history on existing data to “roll back.” For rollback, deploy a previous application revision compatible with the schema and restore verified backups only through a deliberate recovery procedure.
6. **Authentication/operations:** configure email before enabling mandatory verification. OAuth enrollment and the signup pause switch need joint staging acceptance. There is no MFA, all-device signout UI, provider delivery monitoring, independent penetration test or comprehensive secret scan. A simple tracked-file credential-pattern check found no matches; that is not a secret-scanner certification.
7. **Design/performance:** no editable Canva/Figma file; the Sketchfab asset cannot be self-hosted without permission; real-device/WebGL compatibility and mobile LCP need further work. Automated accessibility scores do not establish complete WCAG compliance for every state.

## Git handoff

Local branch: `chore/production-takeover`, based on `90f8a86`.

- `f672005` — update Next.js and vulnerable runtime dependencies.
- `8707b87` — sessions, media jobs, account deletion, authorization and regression coverage.
- `2ffe96a` — photographic landing, exact on-demand guitar embed, static catalog, responsive/accessibility improvements and assets.
- The documentation commit following these records the final evidence and limitations.

Nothing was merged into `main` or pushed to a remote.
