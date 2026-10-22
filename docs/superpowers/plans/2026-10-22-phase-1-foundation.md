# Phase 1 — Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Resoniq the identity, authorization, audit and background-job foundations every later phase builds on: public profiles with handles, follows, live role/status enforcement, an audit log, a Postgres job queue with a worker service, and account deletion.

**Architecture:** This extends the existing Prisma schema and `lib/api.ts` plumbing. `requireActor()` reads role and status from the DB on every authenticated call, so JWT sessions can't outlive a ban. Jobs are rows claimed with `FOR UPDATE SKIP LOCKED` by a `tsx`-run worker in its own compose service. SQL-sensitive behavior is tested against a real Postgres through a new integration suite. Route behavior keeps using the existing mocked-Prisma route tests.

**Tech Stack:** Next.js 16 route handlers, Prisma 6 / Postgres 16, NextAuth v5, Vitest 5, `tsx` (new dependency, used for the worker and CLI).

**Spec:** `docs/superpowers/specs/2026-10-22-platform-evolution-design.md` (decisions D2, D14, D1; data model "Identity (P1)").

## Global Constraints

- Work on local branch `feat/platform-foundation` off `main`. **Don't merge into main and don't push.**
- Commit messages: professional, concise, conventional (`feat:`, `test:`…), with **no** AI attribution or Co-Authored-By lines. Stage explicit paths and never use `git add -A`.
- Every API handler is wrapped in `route()` from `frontend/lib/api.ts`. Ownership and visibility are enforced inside the query, and an invisible resource is a 404.
- JSON bodies go through `readJson()`. Validation errors are `ValidationError` → `ApiError(400)`.
- Existing routes, response shapes, and tests keep working. Update the mocks they need, but don't weaken their assertions.
- A user's email must never appear in any public response or be used to derive a handle.
- Node ≥ 22, Prisma 6, no new dependencies besides `tsx`.
- Checks that must pass at the end of every task: `cd frontend && npm run lint -- --max-warnings=0 && npm run typecheck && npm test && npm run test:int`.

## Review Focus

- **Double-click follow/unfollow:** concurrent PUT/DELETE on the same pair must leave `followerCount`/`followingCount` equal to the real row count, and never negative. Test in Task 7.
- **Banned while holding a valid JWT:** the next write must get 403 and the next page load must redirect, without waiting for the token to expire. Tests in Task 3.
- **Handle input variety:** `"Jöhn Doe!"` → `john_doe`, `"ADMIN"` → reserved, a taken base gets a suffix, an all-emoji name falls back to the DB default. Tests in Task 2.
- **Two workers racing:** two concurrent `claimNext` calls must never return the same job. Test in Task 5.
- **Worker crash mid-job:** a RUNNING job with a stale lock goes back to QUEUED. A job that keeps failing ends FAILED with `lastError` kept. Tests in Task 5.

---

### Task 1: Integration test harness on real Postgres

**Files:**
- Create: `frontend/vitest.integration.config.mts`
- Create: `frontend/tests/integration/global-setup.ts`
- Create: `frontend/tests/integration/db.ts`
- Create: `frontend/tests/integration/tone-compat.int.test.ts`
- Modify: `frontend/vitest.config.mts` (exclude `tests/integration/**`)
- Modify: `frontend/package.json` (script `test:int`)
- Modify: `.github/workflows/ci.yml` (new `integration` job)

**Interfaces:**
- Produces: `resetDb(): Promise<void>` and `prisma` re-export in `tests/integration/db.ts`, and the `npm run test:int` command. Env: `TEST_DATABASE_URL`.

- [ ] **Step 1: Write the failing test** `tests/integration/tone-compat.int.test.ts`
  - `it("reads legacy and v2 tones straight from the database")`: create a user, then a Tone with `data` = `{ profile: <EngineToneProfile fixture>, amp: {gain: 70, bass: 40, mid: 55, treble: 60, presence: 50} }` and one with `{ version: 2, recipe: <parseRecipeCore(validRecipe())> }`. Read both back with `prisma.tone.findMany` and assert `recipeFromStoredTone(t, null)` is non-null for each, and that the legacy one has `amp.gain === 70`.
  - `beforeEach(resetDb)`.
- [ ] **Step 2: Run it and confirm it fails**
  Run: `cd frontend && npm run test:int` → fails with `Missing script: "test:int"`.
- [ ] **Step 3: Implement the harness**
  - `vitest.integration.config.mts`: same `@` alias as `vitest.config.mts`; `include: ["tests/integration/**/*.int.test.ts"]`; `globalSetup: ["tests/integration/global-setup.ts"]`; `fileParallelism: false`; `env: { DATABASE_URL: process.env.TEST_DATABASE_URL, AUTH_SECRET: "test-secret" }`.
  - `global-setup.ts`: throw unless `TEST_DATABASE_URL` is set **and its database name ends in `_test`** (this guards against truncating a real DB). Then run `npx prisma migrate reset --force --skip-generate --skip-seed` with `DATABASE_URL=TEST_DATABASE_URL` via `execFileSync`.
  - `db.ts`: `resetDb()` runs `TRUNCATE ... RESTART IDENTITY CASCADE` over every table in `pg_tables` where `schemaname = 'public' AND tablename <> '_prisma_migrations'`.
  - `vitest.config.mts`: add `exclude: ["tests/integration/**", "node_modules/**"]`.
  - `package.json`: `"test:int": "vitest run -c vitest.integration.config.mts"`.
  - CI: job `integration` with a `postgres:16-alpine` service (user/pass `resoniq`, db `resoniq_test`, health check `pg_isready`), env `TEST_DATABASE_URL=postgresql://resoniq:resoniq@localhost:5432/resoniq_test`, then `npm ci` and `npm run test:int` in `frontend`.
- [ ] **Step 4: Run it and confirm it passes**
  Local DB: `docker compose up -d postgres && createdb -h localhost -U resoniq resoniq_test` (password `resoniq`).
  Run: `TEST_DATABASE_URL=postgresql://resoniq:resoniq@localhost:5432/resoniq_test npm run test:int` → 1 passed. `npm test` still passes and runs no `.int.` files.
- [ ] **Step 5: Commit**
  `git add frontend/vitest.integration.config.mts frontend/vitest.config.mts frontend/tests/integration frontend/package.json .github/workflows/ci.yml && git commit -m "test: add Postgres integration suite"`

---

### Task 2: Identity schema, handles and profile fields

**Files:**
- Modify: `frontend/prisma/schema.prisma` (User fields, enums `Role`, `AccountStatus`, model `Follow`, model `AuditLog`)
- Create: `frontend/prisma/migrations/<timestamp>_identity/migration.sql` (generated with `--create-only`, then edited)
- Create: `frontend/lib/handles.ts`
- Modify: `frontend/app/api/register/route.ts` (assign handle from name)
- Test: `frontend/tests/handles.test.ts`, `frontend/tests/integration/identity.int.test.ts`

**Interfaces:**
- Produces:
  - `User` gains: `handle String @unique @default(dbgenerated("('u_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10))"))`, `bio String?`, `instruments String[]`, `genres String[]`, `links Json?`, `role Role @default(USER)`, `status AccountStatus @default(ACTIVE)`, `suspendedUntil DateTime?`, `statusReason String?`, `reputation Int @default(0)`, `followerCount Int @default(0)`, `followingCount Int @default(0)`, plus relations `followers Follow[] @relation("following")` and `following Follow[] @relation("follower")`.
  - `enum Role { USER MODERATOR ADMIN }`, `enum AccountStatus { ACTIVE SUSPENDED BANNED }`.
  - `model Follow { followerId, followingId, createdAt @default(now()); @@id([followerId, followingId]); @@index([followingId, createdAt]); @@index([followerId, createdAt]) }`, both FKs `onDelete: Cascade`.
  - `model AuditLog { id, actorId String? (FK SetNull), action String, targetType String, targetId String, reason String?, meta Json?, createdAt; @@index([targetType, targetId]); @@index([actorId, createdAt]); @@index([createdAt]) }`.
  - `lib/handles.ts`: `HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/`; `RESERVED_HANDLES: ReadonlySet<string>` (at least: admin, administrator, api, app, c, compare, copyright, explore, feed, gear, help, library, login, logout, me, mod, moderator, new, notifications, p, resoniq, search, settings, signup, staff, support, system, t, tag, tones, u); `normalizeHandle(v: unknown): string` (trims, strips a leading `@`, lowercases; throws `ValidationError` for pattern or reserved); `handleFromName(name: string | null): string | null` (NFKD, strip combining marks, lowercase, runs of non-`[a-z0-9]` → `_`, trim `_`, cut to 24; null if under 3 chars or reserved); `assignHandle(db: Prisma.TransactionClient | PrismaClient, base: string): Promise<string>` (first free of `base`, `base_2`…`base_9`, then `base_<4 random hex>`).
- [ ] **Step 1: Write the failing unit tests** `tests/handles.test.ts`
  - `normalizeHandle("@Riff_Lord")` → `"riff_lord"`; `normalizeHandle("ab")`, `normalizeHandle("bad handle")`, `normalizeHandle("Admin")` each throw `ValidationError`.
  - `handleFromName("Jöhn Doe!")` → `"john_doe"`; `handleFromName("🎸🎸")` → `null`; `handleFromName("Settings")` → `null`; `handleFromName("a".repeat(40))` has length 24.
- [ ] **Step 2: Write the failing integration test** `tests/integration/identity.int.test.ts`
  - `it("gives new users a default handle")`: `prisma.user.create({ data: { email: "x@test.dev" } })` → `handle` matches `/^u_[0-9a-f]{10}$/`.
  - `it("rejects handles that break the pattern at the database")`: raw `UPDATE "User" SET handle = 'Bad Handle'` rejects (check constraint).
  - `it("assigns a suffixed handle when the base is taken")`: two users, `assignHandle(prisma, "riff")` twice after creating with `riff` → returns `"riff_2"`.
- [ ] **Step 3: Run both and confirm they fail** (`npm test -- handles`, `npm run test:int`): module not found / column missing.
- [ ] **Step 4: Implement**
  - Schema as above, then `npx prisma migrate dev --create-only --name identity`. Append to the SQL: `ALTER TABLE "User" ADD CONSTRAINT "User_handle_format" CHECK (handle ~ '^[a-z0-9_]{3,30}$');`. Postgres evaluates the volatile default per existing row, so all current users get a unique `u_…` handle. **No email-derived handles.**
  - `register/route.ts`: when `displayName` yields `handleFromName(...)`, set `handle: await assignHandle(prisma, base)` in the existing `create`. Otherwise leave it to the DB default. If two sign-ups race for the same handle and `create` throws `P2002` on `handle`, retry once without `handle` (DB default) instead of returning a 500. Keep the identical-response behavior for existing emails.
  - Update `tests/routes.test.ts` mocks so the register tests still pass: add `user.findUnique`, and stub `assignHandle` if it's needed.
- [ ] **Step 5: Run and confirm they pass:** `npm test && npm run test:int`.
- [ ] **Step 6: Commit** `git add frontend/prisma frontend/lib/handles.ts frontend/app/api/register/route.ts frontend/tests && git commit -m "feat: add handles, profile fields and follow schema"`

---

### Task 3: Live actor checks, permissions and banned sign-in

**Files:**
- Create: `frontend/lib/authz.ts`, `frontend/lib/permissions.ts`
- Modify: `frontend/lib/api.ts` (`requireUserId` delegates to `requireActor`)
- Modify: `frontend/lib/session.ts` (`requirePageUserId` refuses banned users)
- Modify: `frontend/auth.ts` (refuse banned credential and Google sign-in)
- Modify: write routes to pass `{ write: true }`: `app/api/tones/route.ts` (POST), `app/api/tones/[id]/route.ts` (PATCH, DELETE), `app/api/upload/route.ts`, `app/api/analyze/route.ts`
- Modify: `frontend/app/login/page.tsx` or `components/auth/AuthForm.tsx` (show the `account_disabled` error)
- Test: `frontend/tests/authz.test.ts`, `frontend/tests/routes.test.ts`

**Interfaces:**
- Produces:
  - `type Actor = { id: string; handle: string; role: Role; status: AccountStatus; suspendedUntil: Date | null }`
  - `requireActor(opts?: { write?: boolean; message?: string }): Promise<Actor>`. No session or no user row → `ApiError(401, message ?? "Sign in required.")`. `BANNED` → `ApiError(403, "This account has been banned.")`. `SUSPENDED` with `suspendedUntil` in the future (or null = indefinite) and `write` → `ApiError(403, "This account is suspended until <ISO date>.")` (or "…is suspended." when indefinite). An expired suspension counts as active (no write-back here).
  - `getActor(): Promise<Actor | null>` (no throws, for pages and optional auth).
  - `type Permission = "content.moderate" | "users.suspend" | "users.ban" | "users.roles" | "communities.manage" | "catalog.manage" | "curation.manage" | "platform.config" | "system.view" | "audit.view" | "analytics.view"`.
  - `ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>>`. USER: none. MODERATOR: `content.moderate`, `users.suspend`, `analytics.view`. ADMIN: all.
  - `can(role: Role, p: Permission): boolean`. `requirePermission(p: Permission): Promise<Actor>` → 403 `"Not allowed."` when missing (checked after `requireActor({ write: true })`).
  - `requireUserId(message?: string, opts?: { write?: boolean }): Promise<string>` keeps its current call shape.
- [ ] **Step 1: Write the failing tests**
  - `tests/authz.test.ts` (mock `@/auth` and `@/lib/prisma` the way `routes.test.ts` does):
    - no session → 401; session for a deleted user (`findUnique` → null) → 401;
    - BANNED → 403 for both read and write;
    - SUSPENDED until tomorrow → read OK, write 403 with the date in the message; SUSPENDED until yesterday → write OK;
    - `can("MODERATOR","users.ban") === false`, `can("ADMIN","users.roles") === true`, `can("USER","content.moderate") === false`;
    - `requirePermission("platform.config")` as MODERATOR → 403.
  - `tests/routes.test.ts`: `it("refuses writes from a banned user with a valid session")`: signed in, `db.user.findUnique` → `{ status: "BANNED", ... }`, `POST /api/tones` → 403, and `db.tone.create` is not called. Update `signedIn()` so it also mocks `db.user.findUnique` with an ACTIVE actor, keeping every existing test green.
- [ ] **Step 2: Run and confirm they fail** (`npm test`).
- [ ] **Step 3: Implement** using `prisma.user.findUnique({ where: { id }, select: { id, handle, role, status, suspendedUntil } })`. `auth.ts`: in `authorize`, after the password check, return `throw new AccountDisabled()` (a `CredentialsSignin` with `code = "account_disabled"`) when the status is BANNED. Add a `callbacks.signIn` that returns `false` for a BANNED user found by id/email (covers Google). `requirePageUserId`: banned → `redirect("/login?error=account_disabled")`.
- [ ] **Step 4: Run and confirm they pass** (`npm test`, `npm run typecheck`).
- [ ] **Step 5: Commit** `git add frontend/lib/authz.ts frontend/lib/permissions.ts frontend/lib/api.ts frontend/lib/session.ts frontend/auth.ts frontend/app/api frontend/components/auth frontend/app/login frontend/tests && git commit -m "feat: enforce account status and roles on every request"`

---

### Task 4: Audit log helper and role-grant CLI

**Files:**
- Create: `frontend/lib/audit.ts`
- Create: `frontend/scripts/grant-role.ts`
- Modify: `frontend/package.json` (add `tsx` dependency and script `"admin:grant": "tsx scripts/grant-role.ts"`)
- Test: `frontend/tests/integration/audit.int.test.ts`

**Interfaces:**
- Produces:
  - `type AuditEntry = { actorId: string | null; action: string; targetType: string; targetId: string; reason?: string; meta?: Prisma.InputJsonValue }`
  - `recordAudit(db: Prisma.TransactionClient | PrismaClient, entry: AuditEntry): Promise<void>`. Callers pass the same `tx` as the change they make, so the action and its audit row commit together.
  - `grantRole(db, { email: string; role: Role }): Promise<{ id: string; previous: Role }>`, exported from `scripts/grant-role.ts` for the test. The CLI is `npm run admin:grant -- --email you@example.com --role ADMIN` and writes audit action `"user.role.grant"` with `actorId: null` and `meta: { via: "cli", previous }`. Unknown email → exit 1 with "No user with that email."
- [ ] **Step 1: Write the failing integration test:** `grantRole` promotes a user, creates exactly one `AuditLog` row with `action: "user.role.grant"`, `targetType: "User"`, `targetId: user.id`, and rejects an unknown email.
- [ ] **Step 2: Run and confirm it fails** (`npm run test:int`).
- [ ] **Step 3: Implement** (role change and audit in one `$transaction`; parse args with `node:util` `parseArgs`).
- [ ] **Step 4: Run and confirm it passes**, then `npm run admin:grant -- --email nobody@x --role ADMIN` against the dev DB → prints the error and exits 1.
- [ ] **Step 5: Commit** `git add frontend/lib/audit.ts frontend/scripts/grant-role.ts frontend/package.json frontend/package-lock.json frontend/tests/integration/audit.int.test.ts && git commit -m "feat: add audit log and role-grant CLI"`

---

### Task 5: Postgres job queue and worker service

**Files:**
- Modify: `frontend/prisma/schema.prisma` (model `Job`, enum `JobStatus`) + migration `<timestamp>_jobs`
- Create: `frontend/lib/jobs/queue.ts`, `frontend/lib/jobs/handlers.ts`
- Create: `frontend/worker/run.ts`, `frontend/worker/index.ts`
- Modify: `frontend/Dockerfile` (stage `worker`), `docker-compose.yml` (service `worker`)
- Test: `frontend/tests/jobs.test.ts`, `frontend/tests/integration/jobs.int.test.ts`

**Interfaces:**
- Produces:
  - `model Job { id cuid, type String, payload Json, status JobStatus @default(QUEUED), attempts Int @default(0), maxAttempts Int @default(5), runAt DateTime @default(now()), lockedAt DateTime?, lockedBy String?, lastError String?, createdAt @default(now()), finishedAt DateTime?; @@index([status, runAt]) }`. `enum JobStatus { QUEUED RUNNING SUCCEEDED FAILED }`.
  - `type JobPayloads = { "storage.delete": { key: string } }` (later phases add types here); `type JobType = keyof JobPayloads`.
  - `enqueue<T extends JobType>(type: T, payload: JobPayloads[T], opts?: { db?: Prisma.TransactionClient; runAt?: Date; maxAttempts?: number }): Promise<string>`
  - `claimNext(workerId: string): Promise<Job | null>`: one raw statement, `UPDATE "Job" SET status='RUNNING', "lockedAt"=now(), "lockedBy"=$1, attempts=attempts+1 WHERE id = (SELECT id FROM "Job" WHERE status='QUEUED' AND "runAt" <= now() ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`.
  - `completeJob(id: string): Promise<void>` (SUCCEEDED, `finishedAt`, clears lock).
  - `failJob(job: Pick<Job,"id"|"attempts"|"maxAttempts">, err: unknown, now?: Date): Promise<void>`: FAILED with `finishedAt` when `attempts >= maxAttempts`, otherwise QUEUED with `runAt = now + backoffMs(attempts)`. `lastError` is cut to 2000 chars.
  - `backoffMs(attempts: number): number` = `Math.min(30_000 * 2 ** (attempts - 1), 3_600_000)`.
  - `requeueStale(staleMs = 15 * 60_000): Promise<number>`: RUNNING jobs with `lockedAt < now() - staleMs` → QUEUED, lock cleared.
  - `handlers: { [K in JobType]: (payload: JobPayloads[K]) => Promise<void> }`. `storage.delete` → `getStorage().remove(key)`.
  - `runOnce(workerId: string): Promise<"idle" | "succeeded" | "failed">`: an unknown `type` fails with `"Unknown job type: <type>"`.
  - `worker/index.ts`: a loop that calls `requeueStale()` every 60 s, then `runOnce`, sleeping 2 s when idle. On SIGTERM/SIGINT it finishes the current job and then exits 0. Logs one line per job (id, type, outcome, ms).
- [ ] **Step 1: Write the failing tests**
  - `tests/jobs.test.ts`: `backoffMs(1) === 30_000`, `backoffMs(3) === 120_000`, `backoffMs(20) === 3_600_000`.
  - `tests/integration/jobs.int.test.ts`:
    - `it("never hands one job to two workers")`: enqueue 1 job; `Promise.all([claimNext("a"), claimNext("b")])` → exactly one non-null.
    - `it("skips jobs scheduled in the future")`.
    - `it("retries with backoff, then gives up")`: `maxAttempts: 2`; claim + fail → QUEUED with `runAt` ≈ now+30 s; force `runAt` to now, claim + fail → FAILED, `lastError` set.
    - `it("requeues a job whose worker died")`: claim, set `lockedAt` to 20 min ago, `requeueStale()` → 1, status QUEUED.
    - `it("runs storage.delete through runOnce")` with a `localStorageDriver` temp dir: put a file, enqueue a delete for its key, `runOnce` → `"succeeded"`, the file is gone.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement**, including the migration (`npx prisma migrate dev --name jobs`).
  - Dockerfile: `FROM builder AS worker`, `USER node`, `CMD ["npx", "tsx", "worker/index.ts"]`. Builder already has full `node_modules` and the source. Phase 4 adds ffmpeg to this stage.
  - Compose: service `worker` (build target `worker`, the same `DATABASE_URL`/storage env as `frontend`, the `song_data:/data/songs` volume, `depends_on: migrate: service_completed_successfully`, `restart: unless-stopped`).
- [ ] **Step 4: Run and confirm they pass.** Then `docker compose build worker && docker compose up -d worker && docker compose logs worker` → shows the idle loop started with no errors.
- [ ] **Step 5: Commit** `git add frontend/prisma frontend/lib/jobs frontend/worker frontend/Dockerfile docker-compose.yml frontend/tests && git commit -m "feat: add Postgres-backed job queue and worker service"`

---

### Task 6: Public profiles and profile editing

**Files:**
- Create: `frontend/lib/profiles.ts`, `frontend/lib/profile-validation.ts`, `frontend/lib/pagination.ts`
- Create: `frontend/app/api/users/[handle]/route.ts` (GET), `frontend/app/api/me/route.ts` (GET, PATCH)
- Modify: `frontend/lib/rate-limit.ts` (`profileWrite: { limit: 20, windowMs: 60 * 60_000 }`, `follow: { limit: 120, windowMs: 60 * 60_000 }`, `socialRead: { limit: 240, windowMs: 60_000 }`)
- Test: `frontend/tests/profiles.test.ts`, `frontend/tests/routes.test.ts`

**Interfaces:**
- Produces:
  - `INSTRUMENTS = ["electric-guitar","acoustic-guitar","bass","extended-range","keys","drums","vocals","production"] as const`
  - `type PublicProfile = { id; handle; name: string | null; image: string | null; bio: string | null; instruments: string[]; genres: string[]; links: {label: string; url: string}[]; followerCount; followingCount; reputation; createdAt: string; viewerFollows: boolean; isSelf: boolean }`. **No email, role, or status fields.**
  - `getPublicProfile(handle: string, viewerId: string | null): Promise<PublicProfile | null>`: null for unknown handles or BANNED users.
  - `parseProfilePatch(body: Record<string, unknown>): ProfilePatch`, where `ProfilePatch = Partial<{ name: string | null; handle: string; bio: string | null; instruments: string[]; genres: string[]; links: {label;url}[] }>`. Rules: name ≤ `MAX_NAME_LENGTH` (from `lib/credentials`); bio trimmed, ≤ 500; instruments ⊆ `INSTRUMENTS`, deduped, ≤ 4; genres lowercased, `^[a-z0-9][a-z0-9 -]{0,23}$`, deduped, ≤ 8; links ≤ 5, label 1–40, url ≤ 200, parseable, protocol `https:` or `http:` only; handle via `normalizeHandle`. Unknown keys are ignored. Any violation → `ValidationError` with a user-facing message.
  - `PATCH /api/me` → `{ profile: PublicProfile }`. A taken handle (Prisma `P2002`) → 409 `"That handle is taken."`. Uses `requireActor({ write: true })` and the `profileWrite` limit.
  - `GET /api/me` → `{ profile: PublicProfile, email: string | null, role }` (own account only).
  - `GET /api/users/[handle]` → `{ profile }` or 404, with optional auth (`getActor()`).
  - `lib/pagination.ts`: `type Cursor = { t: string; id: string }`; `encodeCursor(c: Cursor): string` (base64url JSON); `decodeCursor(s: string | null): Cursor | null` (throws `ApiError(400, "Invalid cursor.")` on garbage); `parseLimit(v: string | null, fallback = 20, max = 50): number`.
- [ ] **Step 1: Write the failing tests**
  - `tests/profiles.test.ts`: `parseProfilePatch` accepts a full valid body. It rejects `links: [{label:"x", url:"javascript:alert(1)"}]`, `instruments: ["kazoo"]`, a 501-char bio, and 9 genres. It normalizes `handle: "@NewName"` → `"newname"`. `decodeCursor(encodeCursor(c))` round-trips, `decodeCursor("%%%")` throws, and `parseLimit("500") === 50`.
  - `tests/routes.test.ts`: `GET /api/users/[handle]` response JSON has no `email` key anywhere (deep check with `JSON.stringify(...).includes("@")` on a fixture whose email is `secret@x.dev`). `PATCH /api/me` with a taken handle → 409, while signed out → 401.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.** Profile queries use an explicit `select` with no `email`. The `viewerFollows` lookup is a `follow.findUnique` on the composite key.
- [ ] **Step 4: Run and confirm they pass.**
- [ ] **Step 5: Commit** `git add frontend/lib/profiles.ts frontend/lib/profile-validation.ts frontend/lib/pagination.ts frontend/lib/rate-limit.ts frontend/app/api/users frontend/app/api/me frontend/tests && git commit -m "feat: add public profiles and profile editing"`

---

### Task 7: Follow graph

**Files:**
- Create: `frontend/lib/follows.ts`
- Create: `frontend/app/api/users/[handle]/follow/route.ts` (PUT, DELETE)
- Create: `frontend/app/api/users/[handle]/followers/route.ts`, `frontend/app/api/users/[handle]/following/route.ts` (GET)
- Test: `frontend/tests/integration/follows.int.test.ts`, `frontend/tests/routes.test.ts`

**Interfaces:**
- Consumes: `requireActor`, `getActor` (Task 3), `pagination.ts` (Task 6), `RATE_LIMITS.follow`, `RATE_LIMITS.socialRead`.
- Produces:
  - `follow(followerId: string, followingId: string): Promise<{ following: true; followerCount: number }>`: one `$transaction`. `follow.createMany({ data: [...], skipDuplicates: true })`, and only when `count === 1` increment `User.followerCount` (target) and `followingCount` (actor).
  - `unfollow(followerId, followingId): Promise<{ following: false; followerCount: number }>`: `deleteMany`, and decrement only when `count === 1`.
  - `listFollows(handle: string, direction: "followers" | "following", cursor: Cursor | null, limit: number): Promise<{ items: { handle; name; image; followedAt: string }[]; nextCursor: string | null } | null>`: keyset on `(createdAt DESC, followerId/followingId DESC)` and excludes BANNED users.
  - Routes: following yourself → 400 `"You can't follow yourself."`; an unknown or BANNED target → 404; suspended actor → 403 (via `requireActor({ write: true })`).
- [ ] **Step 1: Write the failing tests**
  - Integration `it("keeps counters exact under concurrent follow/unfollow")`: `Promise.all` of 5× `follow(a,b)` → one Follow row, `b.followerCount === 1`, `a.followingCount === 1`. Then `Promise.all` of 5× `unfollow(a,b)` → counts 0, never negative.
  - Integration `it("paginates followers newest first without gaps")`: 25 followers with distinct `createdAt`. Page 1 (limit 20) + page 2 = all 25, no duplicates, ordered.
  - Route: self-follow → 400; signed out → 401; banned target (mock) → 404.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and confirm they pass.**
- [ ] **Step 5: Commit** `git add frontend/lib/follows.ts frontend/app/api/users frontend/tests && git commit -m "feat: add follow graph with exact counters"`

---

### Task 8: Account deletion

**Files:**
- Modify: `frontend/app/api/me/route.ts` (add DELETE)
- Create: `frontend/lib/account.ts`
- Test: `frontend/tests/integration/account.int.test.ts`, `frontend/tests/routes.test.ts`

**Interfaces:**
- Consumes: `enqueue` (Task 5), `requireActor` (Task 3), `readJson`.
- Produces:
  - `deleteAccount(userId: string): Promise<{ queuedDeletes: number }>`: one `$transaction`. It collects every `Song.storageKey` (non-null) of the user, enqueues a `storage.delete` per key with `{ db: tx }`, fixes the `followingCount`/`followerCount` of everyone the user follows or is followed by (decrement by 1 for each affected row), then deletes the user (the existing cascades remove tones, songs, sessions and accounts).
  - `DELETE /api/me` body `{ confirmHandle: string, password?: string }`. `confirmHandle` must equal the actor's handle (400 `"Type your handle to confirm."`). For accounts with a `passwordHash`, `password` must match via bcrypt (403 `"Password is incorrect."`). Rate-limited with `profileWrite`. Response `{ ok: true }`. The client then calls `signOut()` (wired in P5's settings UI).
- [ ] **Step 1: Write the failing tests**
  - Integration: a user with 2 songs (1 with `storageKey`), 1 tone, following someone and followed by someone. `deleteAccount` → user, tones and songs gone; 1 QUEUED `storage.delete` job with that key; the other users' counters drop by 1.
  - Route: wrong `confirmHandle` → 400; wrong password → 403; signed out → 401.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and confirm they pass.**
- [ ] **Step 5: Commit** `git add frontend/lib/account.ts frontend/app/api/me/route.ts frontend/tests && git commit -m "feat: let users delete their account and purge their audio"`

---

### Task 9: Docs and full verification

**Files:**
- Modify: `README.md` (worker service, `npm run test:int` with `TEST_DATABASE_URL`, `npm run admin:grant`, the new Checks line)
- Modify: `SECURITY.md` (live status checks, roles/permissions, audit log, account deletion, new rate-limit rows)
- Modify: `ROADMAP.md` (move "Background job queue" to partly done: queue exists, analysis isn't on it yet)
- Modify: `scripts/smoke-test.sh` (after sign-up: `GET /api/me` → 200 with a `handle`, and `PATCH /api/me` with a bio → 200)

- [ ] **Step 1:** Update the docs. Document `TEST_DATABASE_URL` (test-only, must end in `_test`) and note that it's not needed in production.
- [ ] **Step 2: Full verification.**
  Run: `cd frontend && npm run lint -- --max-warnings=0 && npm run typecheck && npm test && npm run test:int && npm run build`, then `cd ../python-engine && .venv/bin/ruff check . && .venv/bin/pytest`, then `docker compose up --build -d && BASE_URL=http://localhost:3000 scripts/smoke-test.sh`.
  Expected: every command exits 0 and the smoke test prints its pass summary.
- [ ] **Step 3: Commit** `git add README.md SECURITY.md ROADMAP.md scripts/smoke-test.sh && git commit -m "docs: document worker, roles and integration tests"`
- [ ] **Step 4:** Stop. Report the branch name, the commits, the check output, and anything not verified. Don't merge.
