# Releases, credits and music discovery

How finished music gets from a musician's private workspace onto their profile, who gets told, and how listeners find it. Code lives in `frontend/lib/publishing.ts`, `lib/credits.ts`, `lib/music.ts` and `lib/onboarding.ts`.

## Releases

A release is an ordinary `Post` with `category = ORIGINAL` and a `release` JSON snapshot:

- **Source.** A song from the Songwriting Canvas (`canvasId`, with its chart) or a take from the Riff Vault (`takeId`). Only the owner of the song or riff can publish it (`buildRelease`).
- **Snapshot.** The chart and take metadata are copied into the post, so later edits to the song don't change what was released. The author can refresh the chart from the canvas through Manage release.
- **Mixes.** `release.takes` holds up to `MAX_MIXES` (6) named takes, such as "Album" or "Acoustic". `take` is always `takes[0]`. `Post.releaseTakeIds` (GIN-indexed) mirrors the list, so playback authorization can ask "is this take part of a release the viewer can see?" (`audibleTake` in `lib/riffs/service.ts`). Older single-take releases are normalised by `readRelease`.
- **Revision history.** Each change made through Manage release first writes the previous snapshot to `ReleaseRevision`, and `restoreRelease` brings one back. Revisions are visible to the author only.
- **Category.** Sending `release` to `POST /api/posts` always makes the post `ORIGINAL`. That category is what puts it on `/music`.

| Endpoint | What it does |
| --- | --- |
| `POST /api/posts` with `release: { canvasId?, takeId?, credits? }` | Publish. Permissions and credits are validated before anything is written. |
| `GET /api/posts/:id/release` | Author only. Current mixes, candidate takes from the same song or project, and revisions. |
| `PATCH /api/posts/:id/release` | Author only. Rename, reorder, add or remove mixes; optionally refresh the chart; optional note. |
| `POST /api/posts/:id/release/revisions/:rid` | Author only. Restore an earlier version (the current one is saved first). |
| `POST /api/posts/:id/credit` with `{ action: "confirm" \| "dispute", note? }` | A credited musician answers their credit. |

## Credits

Credits are rows in `ReleaseCredit (postId, userId, role, status, note)`.

- The author's own credit is `CONFIRMED`. Everyone else starts out `PENDING` and is asked to confirm.
- You can credit yourself and anyone who has been a member of the project the music came from. Music outside a project can only credit the author.
- **Confirm** lists the release on the credited musician's profile. **Dispute** hides the credit from everyone but the author, who sees the optional note. Answers can be changed later.
- `Post.creditUserIds` is kept equal to the *confirmed* credits (`syncCreditIds`). Profile "music" tabs query it, so an unconfirmed or disputed name can never put a release on someone's profile.

## Announcements

`announceRelease(postId)` in `lib/credits.ts` is the single place that tells people about a release:

- credited musicians (other than the author) get `CREDIT_ADDED`
- followers get `NEW_RELEASE`, unless they were already credited, or the post lives inside a community (community posts stay inside their community)

A post can become public in three places, and each one calls `announceRelease`:

1. `POST /api/posts`, when the post is published straight away
2. `moderatePost(..., "restore")`, when a moderator approves a post the content screen held
3. `settlePost` in `lib/media/process.ts`, when attached media finishes processing

It only sends once per post. If a `CREDIT_ADDED` or `NEW_RELEASE` notification already exists for the post, it does nothing. A release that was announced, then held after an edit and approved again, stays quiet.

**Limit:** followers are notified in a single insert, capped at an artist's 2,000 newest followers. Move this to the jobs table (`lib/jobs`) if an artist outgrows that.

## Timestamped feedback

Comments on releases and notes from listening sessions can contain timestamps (`1:23`). `components/media/seek.tsx` provides `SeekProvider`, `TimeLink` and `SeekMarks`:

- a player registers itself with `useSeekTarget`
- any `TimeLink` inside the same provider seeks and plays it
- `SeekMarks` draws the timestamps on the waveform

The Riff Vault shows listening-session notes for a take only to people who can see the project (`getRiff` → `feedback`).

## Discovery (`/music`)

`GET /api/music?genre=&scope=for-you&sort=new|top&cursor=` backs the page; `lib/music.ts` holds the queries.

- **Genre.** A release matches a genre if the artist lists it or the post is tagged with it (`genreWhere`). The genre chips come from what releasing artists actually list (`musicGenres`).
- **For you.** Signed in only. Releases from people you follow and from artists who share one of your genres, never your own (`forYouWhere`).
- **Artists to discover.** People who have released music, excluding you and anyone you already follow, with shared genres ranked first (`artistsToDiscover`).

Everything is built from real activity; nothing is seeded or boosted.

### Suggestion pool

Musician suggestions (`artistsToDiscover`, and `welcomeMusicians` on `/welcome`) start from `suggestionPool` in `lib/discovery.ts`:

- up to 50 people who share a genre or instrument with you, found by array overlap on the GIN indexes `User_genres_idx` and `User_instruments_idx`
- topped up with the 20 most-followed

The pool is loaded and ranked in memory: shared genres count double and shared instruments once, ties go to the most followed. Because the pool is bounded and the overlap is matched in SQL, a matching musician with few followers is still found as the user table grows.

## Onboarding (`/welcome`)

New accounts land on `/welcome` after signing up (the signup page's default `callbackUrl`). It has three steps, all derived from real data by `onboardingSteps`, so nothing extra is stored:

1. **Interests.** At least one instrument and one genre, saved to the same public profile fields that Settings edits.
2. **Follows.** `followingCount > 0`.
3. **First thing.** Any tone, riff or post.

Until all three are done, the feed shows `GettingStartedCard`, which links back to `/welcome`. Hiding the card is remembered per browser in `localStorage` (`resoniq:welcome-dismissed`).
