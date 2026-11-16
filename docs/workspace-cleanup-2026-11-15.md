# Local workspace cleanup — 2026-11-15

The workspace is the outer `Resoniq/` directory; the application Git checkout is its inner `Resoniq/` directory. Cleanup changed no application source, manifests, lockfiles, migrations or deployment configuration. Existing Creator Insights work on `feat/creator-insights` was preserved and excluded from the cleanup commit.

## Storage and removals

Sizes use allocated blocks from `du -sk`, including hidden files, dependencies, Git history and quarantine. Quarantine is retained locally, so moving files there does not count as recovered storage. Final measurements are rounded to two decimal places; the small report/commit metadata can change exact byte counts.

- Before: **6,859,378,688 bytes (6.39 GiB)** across the workspace; **3,904,151,552 bytes (3.64 GiB)** in the application checkout.
- After verification and final cache removal: **2.44 GiB** across the workspace; **2.43 GiB** in the application checkout, including **672.83 MiB** of quarantine and verification evidence.
- Net recovered storage: **3.94 GiB**, after retaining the fresh production build, active dependencies and all quarantined material.
- Initial removal: **10,400 generated files**, recovering **4,464,107,520 bytes (4.16 GiB)** before rebuilding.
- Removed **14 promotional MP4s**, **24 derived audio mixes/stems**, and **392 generated review/poster JPEGs** from `after-the-shift`, `first-light`, `bassist-wanted`, and `specimen-of-a-tone`.
- Removed the old `.next/` output (about 2 GiB), stale Playwright `test-results/` (about 61 MiB), TypeScript build information, Python bytecode/tool caches, and Finder metadata.
- The old `.next/` tree included rebuildable standalone dependency copies. Active `node_modules/`, the Python virtual environment, and all dependency declarations were retained.
- After testing, another **51 regenerated cache files** were removed, including `.next/cache/`, Python test/bytecode caches, Vitest cache and TypeScript build information. The current `.next/` production output remains available. The empty outer `.playwright/` directory was removed.

## Quarantine and preserved work

The Git-ignored `.cleanup-quarantine/2026-11-15/` contains:

- `creative/<film-name>/`: all four film projects' remaining sources, handwritten build scripts, raw narration, sound effects, models, fonts, credits and original/alternate archives. **286 preserved creative files** were hash-checked after moving. The films are not referenced by application source or deployment configuration.
- `previous-validation/output/` and `previous-validation/.playwright-cli/`: historical screenshots, reports, logs, browser snapshots and ad hoc validation scripts. Some documentation mentions their former ignored paths; restore these directories to the repository root if needed.
- `inventory.json`: the exact removed-file list, classifications and quarantine destinations. `README.md` explains restoration.

To resume a film, move `creative/<film-name>` back to the outer workspace. Its generated renders must be rebuilt. Archived original and alternate versions remain available. In particular, film `build/` folders contain source scripts and were preserved.

Local uploaded songs/media in `frontend/.storage/`, environment files, deploy secrets, database dumps, Git bundles/refs, all source and test fixtures, migrations, configuration, documentation, and the README screenshots were preserved. Existing Git worktree metadata was retained. Hashes were captured before cleanup for repository files, untracked feature files, local uploaded media, environment files and outer-workspace backup files, then checked after cleanup.

No remote storage, production database, hosting service, branch publication, merge or deployment was touched. Database-backed verification used newly initialized local PostgreSQL databases and temporary storage outside the workspace.

## Source and tooling review

- Exact duplicate pairs `public/brand/app-icon.svg` / `public/brand/explorations/a-dial-q.svg` and `public/brand/mark.svg` / `public/logo.svg` remain: branding documentation, generator scripts and public paths give these files distinct purposes.
- `components/animations/WaveformBackground.tsx` has no obvious filename/import references. It remains in place because source ownership/abandonment is uncertain.
- Existing release/admin/branding scripts and agent configuration remain; absence from an npm script does not prove tooling is obsolete.
- `.gitignore` now excludes quarantine, coverage reports, editor/OS leftovers, logs, temporary files and the four standalone film folder names. It does not blanket-ignore audio/video, screenshots or application assets. Representative generated and protected source paths were checked with `git check-ignore`.

## Verification

- Frontend ESLint with zero warnings: passed.
- Typecheck (`next typegen && tsc --noEmit`): passed.
- Frontend unit/route tests: **423 passed** across 50 files.
- PostgreSQL integration tests: **167 passed** across 32 files, including Studio, Riff Vault, collaboration, media processing and publishing. All migrations applied to a fresh test database.
- Python Ruff: passed. Pytest: **68 passed**, with three dependency deprecation warnings.
- Production build (`npm run build`, Next.js/Turbopack): passed from an empty `.next/` directory.
- Real local audio-analysis smoke test: passed (generated WAV upload, Python analysis, heuristic recipe, access control, tone save/search/share/delete). No paid model call was used.
- Real local platform smoke test: passed (two members, discovery, private/public tones, generated video upload, ffmpeg worker processing, range playback, posts, comments, notifications, permissions and account deletion).
- Existing Playwright suite: **44 passed, zero skipped**, across all 14 specifications on desktop Chrome and Pixel 7 Chrome emulation. This includes all 16 Amp Studio checks, fake-microphone recording, Riff Vault, publishing/listen tracking, credits, synchronized listening rooms, collaborative writing, project progress and tone history.
- Final preservation check: **921 repository/data files and 286 creative files** matched their before-cleanup SHA-256 hashes. The intentional `.gitignore` edit and deleted Finder metadata are excluded from the protected-file comparison. `git diff --check` passed.

Results apply to the full working tree, including the existing uncommitted Creator Insights work. They do not represent an isolated checkout of the cleanup commit. Verification logs, candidate audits and browser output are retained in the ignored quarantine's `verification/` folder. Temporary test databases/storage were removed and the temporary servers/worker were stopped.

Recording passed on both viewports but emitted `Cannot close a closed AudioContext` rejections. The existing recorder calls the same cleanup from `stop()` and the review effect cleanup; this source was unchanged and the lifecycle issue was left outside the cleanup commit. Python emitted three dependency deprecation warnings. Physical audio hardware, Safari/WebKit, hosted services and deployments were not tested.
