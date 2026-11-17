# Reliability guide

How the parts of Resoniq that hold a musician's unsaved work behave when
something goes wrong, and how each behaviour is tested. Read this before
changing recording, songwriting sync, uploads or analysis.

## Unsaved work

`components/app/UnsavedChanges.tsx` is the single registry for work that
exists only in the browser. A component calls `useUnsavedChanges({ dirty,
label, save? })`. While anything is dirty, closing the tab gets the
browser's warning, and in-app links and Back ask *Save / Discard / Keep
editing*. Add a guard to any new editor instead of writing its own
`beforeunload` handler.

The provider wraps every app page, so its dialog is loaded with
`next/dynamic` the first time it is needed.

## Recording (`components/riffs/Recorder.tsx`)

- **One teardown.** Starting a take creates a meter `AudioContext`, a
  microphone stream, an animation frame and a timer. They are released by
  `cleanup.current`, which first replaces itself with a no-op. The function
  is shared by Stop and the unmount/review effect, so the context is closed
  once. (Closing it twice threw "Cannot close a closed AudioContext".)
- **Metadata never blocks a take.** `describe()` decodes the blob for
  duration and peaks in its own context, which is closed in `finally`. If
  the browser can't decode the format, the take is still kept with
  `durationSec` and `peaks` set to null.
- **Leaving asks first.** A take that is recording or waiting for *Keep* is
  registered as unsaved work. Discarding it releases the microphone.

Tests: `tests/e2e/riffs-recording.spec.ts` uses Chrome's fake capture device,
plus an init script that counts `AudioContext`s opened and closed (a second
close is counted separately), can make `decodeAudioData` fail, and tracks the
microphone tracks. Run against the code before these fixes, all three tests
fail: two contexts are closed twice, the decoder context leaks, and there is
no leave prompt.

## Songwriting sync (`components/canvas/`)

- **Presence** (`useCanvasPresence`). At most one heartbeat is in flight.
  Section or visibility changes during a slow request are coalesced into one
  follow-up, and requests are aborted on unmount. The interval is 2.5 s while
  the tab is visible and 15 s while hidden.
- **Autosave** (`useCanvasDraft`). The draft saves 1.2 s after typing stops.
  A 409 means someone saved first: the newer version is fetched and merged
  section by section, and the next pass saves the result. If that fetch also
  fails, or the network or server fails, the editor shows "Offline ·
  retrying" and backs off (4 s doubling to 64 s). It never stays stuck on
  "Saving…", and the text stays in the editor.

Tests: `tests/e2e/canvas.spec.ts` checks for one concurrent presence request
(the original hook peaked at 6). It also checks that a forced 409 followed
by a failed refetch recovers to "Saved" without page errors.

## Uploads (`components/media/Uploader.tsx`)

Upload state is reported to the composer from an effect, not from inside a
state updater: updaters must stay pure because React may run them twice and
during render. Removing a file aborts its upload and frees its preview URL.
Leaving the composer aborts unfinished uploads and frees all previews.

## Analysis (`components/tone/AnalysisRunner.tsx`)

The analysis streams NDJSON progress. If the connection drops, the page
polls `/api/songs/:id` instead of reporting a failure. A failed or
unparseable poll response waits for the next poll. On the server,
`recoverAnalysisStatus` marks a job that has been "analyzing" for too long as
failed and interrupted, so a crashed engine can't leave the page spinning
forever.

## Gig Mode keys (`components/gigs/StageView.tsx`)

Arrow, Page and Space keys turn the page, including for Bluetooth page-turner
pedals. They keep working while an on-screen button has focus, which is
where focus is left after a tap. Alt, Ctrl and Cmd combinations belong to the
browser (Alt+← is Back), and typing in a field never turns the page.
`tests/e2e/gigs.spec.ts` uses a three-song setlist, so a double step can't
hide at the end of the list.

## Shared JavaScript

Dialogs that most visitors never open are loaded on demand: the
unsaved-changes dialog, Manage release, reports, tone cards and consent
settings. This keeps the animation runtime out of the shared bundle.
Gzipped JavaScript loaded by a signed-in production build, measured by
summing the page's script chunks:

| Page | Before | After |
| --- | --- | --- |
| /feed | 264 KB | 217 KB |
| /explore | 262 KB | 216 KB |
| /tones | 252 KB | 206 KB |
| /practice | 263 KB | 217 KB |
| /music | 263 KB | 217 KB |

When adding a dialog, import it with `next/dynamic` and render it only after
the first open (see `ReportDialog` in `ProfileMenu`).

## Testing against isolated data

- **Integration** (`npm run test:int`) truncates tables. Point
  `TEST_DATABASE_URL` at a throwaway database whose name ends in `_test`.
- **End to end:** serve a production build on port 3100 with its own
  database, `RESONIQ_STORAGE=local` and a temporary
  `RESONIQ_LOCAL_STORAGE_DIR`. Sign-ups are rate-limited in memory (5 per
  15 minutes per IP), and specs skip when sign-up fails, so restart the
  server between spec files and treat any skip as a failure.
- **Unit:** run `npm test` without `AUTH_URL` or `RESONIQ_STORAGE` exported.
  Some route tests assume they are unset.
- **Worktrees:** if a worktree reuses copied `node_modules`, run
  `npx prisma generate` first. The copied client may match another branch's
  schema.
