# Resoniq Platform Evolution — Design

Status: draft for review (2026-10-22). Nothing here is built yet.
Source brief: "Resoniq — The Ultimate Musician Community Platform" (pasted 2026-10-22).

This doc turns the brief into decisions. Each phase gets its own detailed plan
in `docs/superpowers/plans/` before it starts; Phase 1's is written.

## 1. Where we start

- **Stack:** Next.js 16 App Router, React 19, TS, Tailwind v4, Motion + GSAP,
  NextAuth v5 (JWT sessions), Prisma 6 / Postgres 16, FastAPI + Librosa engine,
  private storage (Supabase bucket or local disk), Vitest + pytest, GitHub CI
  with a compose smoke test. No hosting target yet.
- **Product today:** upload a song → engine measures it → heuristic tone recipe
  → tactile dashboard (knobs, pedalboard, EQ) → save to library → share by
  link at `/t/[id]`.
- **Conventions to keep:** every API handler goes through `route()` in
  `lib/api.ts`; ownership is enforced inside the query (`updateMany` with
  `userId`), and a resource you can't see is a 404; JSON bodies are size-capped
  via `readJson`; storage keys are made on the server and pattern-checked;
  the UI never claims more than the engine knows.
- **Existing routes stay:** `/library`, `/analyze`, `/analyze/[id]`, `/t/[id]`,
  `/login`, `/signup`, and all current `/api/*` paths. New surfaces sit next to
  them.

## 2. Key decisions

| # | Decision | Why | Trade-off |
|---|---|---|---|
| D1 | **Background jobs live in a Postgres `Job` table** (`FOR UPDATE SKIP LOCKED`), run by a Node **worker** service that shares the frontend's Prisma client and storage drivers. | No new infra (Redis etc.), and it's transactional with the rows that enqueue the work. It's enough for media transcoding at this scale. | Throughput is capped by polling, which is fine until thousands of jobs a minute. We'd move to a real queue then. |
| D2 | **Live account check on every authenticated API call.** `requireActor()` loads `{role, status}` by primary key, so a ban or role change applies to the very next request even though sessions are JWTs. | The brief says admin rights are enforced on the server. A JWT on its own would keep a banned user active until it expires. | One indexed PK lookup per authenticated request. |
| D3 | **One vote table powers both "likes" and Reddit-style voting.** An upvote is shown as **Amp** (+1). Downvotes only appear in community discussion views. | It gives a single ranking signal and a single counter. "Likes and votes" as two systems would split engagement and confuse ranking. | Showcase posts can't be downvoted from the home feed. That's deliberate. |
| D4 | **Hot ranking is stored**: `hotRank = sign(s)·log10(max(|s|,1)) + epochSeconds/45000`, recomputed on every vote and indexed. Feeds paginate by keyset on `(hotRank, id)` or `(createdAt, id)`. | The formula doesn't decay over time, so it can be stored. That makes feeds index scans instead of sorting at query time. | "Top this week" needs a time-bounded sort by score, which is fine with an index on `(createdAt)`. |
| D5 | **Provenance is explicit in the tone data.** `Tone.data` v3 = `{ version: 3, recipe?: RecipeCore, rig?: RigSpec, origin }`. `recipe` is **inferred** (from the engine), `rig` is **declared** (by the creator). The UI labels them differently everywhere. | The brief requires separating declared gear from inferred gear. Keeping them in different fields makes it impossible to mix them up. | A v2→v3 read adapter. Writes always produce v3. |
| D6 | **Existing tones migrate to `UNLISTED`**, not `PUBLIC`. | Today anyone with the id can view a tone. UNLISTED keeps exactly that behavior. Making old tones public would publish them without consent. | Users choose to publish them. |
| D7 | **A single MP4 rendition per video** (H.264/AAC, max 1080p, `+faststart`) plus a JPEG poster and a short preview loop. It's served with HTTP Range support (local disk) or short-lived signed URLs (Supabase). | It plays everywhere and is simple to process with ffmpeg in the worker. | No adaptive bitrate (HLS). Shortcut documented; upgrade when bandwidth costs or mobile stalls show up. |
| D8 | **A performance video's audio track becomes a `Song`**, so the existing analysis pipeline can infer its tone, labeled as inferred. | This is how "watch someone play and inspect the tone" connects to the engine Resoniq already has, without new engine code. | The engine still hears the full mix, and the existing caveats apply. |
| D9 | **User text is plain text**, rendered with auto-linked `@mentions`, `#hashtags` and URLs. No Markdown or HTML. | It removes a whole XSS class. Markdown can come later with a vetted sanitizer. | No bold, lists or code blocks in posts. |
| D10 | **Search uses Postgres FTS** (generated `tsvector` + GIN) for posts, tones and communities, and `pg_trgm` for handles and gear names. | No search service needed. Both extensions ship with postgres:16-alpine and Supabase. | Ranking is basic. Move to a dedicated engine if it ever matters. |
| D11 | **No fake activity anywhere.** Seed data is limited to structure (community categories, a gear catalog of real products). The landing page shows live data from the DB (curated/trending) and falls back to real product mechanics (the existing unedited example analysis) labeled "Example", with no invented counts or users. | The brief: "Never simulate real engagement." | On a fresh deploy the landing page has less social proof until people actually post. |
| D12 | **Visuals are custom SVG illustration and real UI compositions, not stock photography.** There are no licensed instrument photos in the repo. Photo slots are designed so you can drop in licensed images later (`public/media/landing/`). | Avoids licensing risk and fits the precision-instrument look. | "Striking photography" depends on you supplying photos. |
| D13 | **Custom icon set** as React components (`components/icons/`), on a 24px grid with a 1.75 stroke, `currentColor`, and `aria-hidden` by default. lucide-react stays only for generic UI glyphs (chevron, close). | Gives Resoniq its own visual language for instruments, gear and signal concepts. | About 40 icons to draw and maintain. |
| D14 | **Roles: `USER`, `MODERATOR`, `ADMIN`.** Permissions come from a static role→permission map in `lib/permissions.ts`. The first admin is granted by a CLI script; nothing in the UI can escalate to it. | Simple and auditable. Community-level moderators are a `CommunityMember.role`, separate from platform roles. | No custom roles. |
| D15 | **3D is done with CSS 3D transforms and layered compositions, not WebGL.** | Gets depth for the hero pedalboard and rig shots without adding three.js. All of it honors `prefers-reduced-motion`. | No free-camera 3D models. |

## 3. Data model (target, built up phase by phase)

All IDs are `cuid()`. Counters are denormalized and updated in the same
transaction as the row that changes them.

**Identity (P1)**
- `User` + `handle` (unique, lowercase, 3–30 `[a-z0-9_]`, DB default
  `u_<10 hex>`), `bio`, `instruments String[]`, `genres String[]`, `links Json`,
  `role Role`, `status AccountStatus (ACTIVE|SUSPENDED|BANNED)`,
  `suspendedUntil`, `statusReason`, `reputation`, `followerCount`,
  `followingCount`.
- `Follow(followerId, followingId, createdAt)`, with a PK on the pair.
- `AuditLog(actorId?, action, targetType, targetId, reason?, meta, createdAt)`.
- `Job(type, payload, status, attempts, maxAttempts, runAt, lockedAt, lockedBy, lastError, finishedAt)`.

**Social (P2)**
- `Community(slug, name, description, kind GENRE|INSTRUMENT|GEAR|STYLE|TOPIC, rules Json, memberCount, postCount, archivedAt)`
- `CommunityMember(userId, communityId, role MEMBER|MODERATOR, joinedAt)`
- `Post(authorId, communityId?, title?, body, toneId?, status PUBLISHED|PROCESSING|HELD|REMOVED|DELETED, removedReason, score, upCount, commentCount, bookmarkCount, hotRank, createdAt, editedAt)`
- `PostTag(postId, tag)`, `Mention(postId?|commentId?, userId)`
- `Comment(postId, authorId, parentId?, depth ≤ 6, body, status, score, createdAt)`
- `PostVote(userId, postId, value ±1)`, `CommentVote(userId, commentId, value ±1)`
- `Bookmark(userId, postId)`
- `Notification(userId, type FOLLOW|MENTION|REPLY|COMMENT|VOTE_MILESTONE|TONE_REMIX|TONE_SAVE|MODERATION|ANNOUNCEMENT, actorId?, postId?, commentId?, toneId?, readAt)`
- `Report(reporterId, targetType POST|COMMENT|USER|MEDIA|COMMUNITY|TONE, targetId, reason SPAM|HARASSMENT|HATE|NSFW|COPYRIGHT|IMPERSONATION|OTHER, details, status OPEN|ACTIONED|DISMISSED, resolvedById, resolution)`
- `Appeal(userId, targetType, targetId, body, status OPEN|UPHELD|REVERSED, decidedById, decisionNote)`

**Tones & gear (P3)**
- `Tone` + `visibility PRIVATE|UNLISTED|PUBLIC` (existing rows → UNLISTED),
  `remixOfId?`, `saveCount`, `remixCount`, `publishedAt?`; `data` v3 (D5).
- `RigSpec` (in JSON, validated): `instrument {kind GUITAR|BASS, gearId?|custom, strings, tuning, pickups[], pickupPosition}`,
  `amp {gearId?|custom, settings Record<string, number>}`, `cab {gearId?|custom, speakers, mic?}`,
  `chain [{gearId?|custom, category, enabled, params Record<string, number|string>}]`,
  `notes, setupGuide, alternatives[], references {songs[], artists[], genres[], styles[]}`.
- `GearItem(slug, kind GUITAR|BASS|PICKUP|AMP|CAB|PEDAL|MULTIFX|MODELER|PLUGIN, brand, model, controls Json, status APPROVED|PENDING|REJECTED, createdById?)`
- `ToneGear(toneId, gearItemId)` (for "popular gear" and gear pages), `ToneSave(userId, toneId)`.

**Media (P4)**
- `Media(ownerId, postId?, position, kind VIDEO|AUDIO|IMAGE, status UPLOADING|PROCESSING|READY|FAILED|REMOVED, originalKey, playbackKey?, posterKey?, previewKey?, mime, sizeBytes, width?, height?, durationSec?, songId?, error?, createdAt)`
- `User.avatarMediaId?`, `User.bannerMediaId?`

**Platform (P6)**
- `FeatureFlag(key PK, enabled, description, updatedById, updatedAt)`
- `Announcement(title, body, level INFO|WARN, startsAt, endsAt, createdById)`
- `FeaturedSlot(placement LANDING|HOME|EXPLORE, postId?|userId?|toneId?|communityId?, position, startsAt?, endsAt?)`
- `ModerationRule(kind BLOCKED_TERM|LINK_HOLD_NEW_ACCOUNTS|MAX_MENTIONS, config Json, enabled)`

## 4. Route map

App (signed-in shell with desktop sidebar and mobile tab bar):
`/feed` (For you · Following · Communities; Hot/New/Top), `/explore`,
`/search?q=&type=`, `/c` and `/c/[slug]`, `/u/[handle]` (Posts · Tones ·
Saved · About), `/p/[id]` (post + threaded comments), `/new` (composer,
`?tone=`), `/tones` (public tone discovery), `/t/[id]` (tone page: rig,
inferred recipe, remix, compare, export), `/compare?a=&b=`, `/gear` and
`/gear/[slug]`, `/tag/[tag]`, `/notifications`, `/bookmarks`, `/settings/*`,
plus the existing `/library` and `/analyze`.

Landing: `/` (public, cached). Sign-in now lands on `/feed`.

Admin (own layout, `/admin/*`): overview, users, content, media, reports,
appeals, communities, curation, gear, tones, analytics, announcements,
flags, rules, system (jobs/health), audit.

## 5. Security and limits

- Platform permissions are checked in every `/api/admin/*` handler and in
  `app/admin/layout.tsx` (pages). Hiding UI is never the control.
- Suspended accounts can read but not write. Banned accounts are signed out
  on their next request and can't sign in. Their content is hidden from
  everyone except moderators.
- Upload caps: video 500 MB / 10 min, audio 50 MB (existing), image 15 MB;
  up to 10 attachments per post; 3 GB per user per 24 h; files are typed by
  magic bytes. Image re-encoding strips EXIF (GPS).
- Media access: READY media on a PUBLISHED post is viewable by anyone allowed
  to see the post. Everything else is owner or moderator only. Removed media is
  blocked right away and purged from storage after 30 days (so a reversed
  appeal can restore it).
- Copyright: a report reason, a public `/copyright` page with the notice
  process, and a moderator "remove for copyright" action that notifies the
  uploader and opens an appeal path.
- New rate-limit buckets per write type (post, comment, vote, follow, report,
  media). They're still in-memory and single-instance (existing caveat in
  SECURITY.md).
- CSP: `media-src`/`img-src` gain the Supabase host when Supabase storage is
  configured.

## 6. Phases

Each phase is one local feature branch, independently testable, and ends
with lint + typecheck + unit + integration + build green. Per your choice,
branches are **not merged or pushed**. Each phase branches from the previous
phase's branch.

| Phase | Branch | Delivers | Done when |
|---|---|---|---|
| **P1 Foundation** | `feat/platform-foundation` | Integration-test harness on real Postgres, profile fields + handle backfill, roles/status with live checks, permissions, audit log, job queue + worker service, follows, profile + account-deletion APIs, admin grant CLI | Plan: `plans/2026-10-22-phase-1-foundation.md` |
| **P2 Social core** | `feat/social-core` | Communities + membership, posts (text, tone-attached), threaded comments, votes, bookmarks, hashtags, mentions, notifications, feeds (for-you/following/community × hot/new/top) with keyset pagination, reporting + appeals intake, automod hook (blocked terms, link hold) | API + integration tests cover feed ordering, counters under concurrency, and visibility of HELD/REMOVED content |
| **P3 Tones & gear** | `feat/tone-sharing` | Tone visibility + data v3 + migration, gear catalog + seed, rig validation, save/remix (credited)/compare/export JSON, publish-from-analysis, ToneGear indexing | An old v2 tone still renders; a remix keeps its credit chain; declared vs inferred stay separate end-to-end |
| **P4 Media** | `feat/media-pipeline` | Upload sessions (streamed to local disk / signed Supabase upload), sniffing (MP4/MOV/WebM/JPEG/PNG/WebP + existing audio), ffmpeg processing jobs (probe, transcode, poster, preview, EXIF strip, audio→Song), range playback, quotas, removal + purge, CSP update | A real phone video goes from upload to playable, with progress, failure and retry visible |
| **P5 App experience** | `feat/app-experience` | Design-system evolution + icon set, app shell (sidebar / tablet rail / mobile tab bar), feed and rich post cards, video player with a "Rig" inspector, composer with progressive gear entry and upload progress, communities, profiles, explore, search (FTS migration), tag pages, notifications, bookmarks, settings, library/analyze integrated (save → edit → publish) | Every surface works at 375/768/1280 with keyboard and screen reader passes on the core flows |
| **P6 Admin console** | `feat/admin-console` | Admin shell + icons, overview, users (status/roles), content + media moderation, report queue, appeals, rules, communities, curation, gear/tone catalog, analytics (SQL aggregates + SVG charts), announcements, flags, system (jobs, retry, health), audit viewer | Every admin action is permission-checked server-side and writes an audit row (tested per route) |
| **P7 Landing** | `feat/landing-evolution` | Oversized editorial hero with a layered rig/UI composition, live community and trending blocks fed by curation, a how-it-works demo reusing real components, gear close-ups, a tone-inspector demo, motion | No invented data; Lighthouse performance ≥ 85 on mobile; reduced-motion respected |
| **P8 Hardening** | `chore/platform-hardening` | Smoke test extended to the social + media flow, CI integration job, index/EXPLAIN review of feed and search queries, caching of landing/explore aggregates, a11y audit, README / SECURITY / ROADMAP / `.env.example` updates | All CI jobs green locally via `act` or by running the same commands |

## 7. Explicitly not doing (now)

- HLS/adaptive streaming, DMs/chat, live streaming, collaborative rig editing,
  payments, a native app, ML content moderation, exports to proprietary
  modeler formats (Helix/Quad Cortex/Kemper). Export is Resoniq JSON only, and
  the UI says so.
- Email verification / password reset stay on the roadmap. They're a known
  gap (SECURITY.md) and become more important once there are public profiles.
  Recommend doing them before any public launch.

## 8. Open questions for you

1. **Photography.** Do you have licensed guitar/bass/amp photos (or a budget
   for them)? If not, D12 stands: illustration plus real UI.
2. **Who creates communities?** Proposal: admins create them, users request
   new ones (flag `community.requests`). Alternative: users with accounts
   older than 7 days can create them freely.
3. **Hosting.** Video makes the "nothing is hosted" situation matter: the
   worker needs ffmpeg and persistent or object storage. Supabase storage +
   any container host (Fly, Railway, Render) fits this design. Pick before P4?
