import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { getCanvas } from "@/lib/canvas/service";
import type { CanvasContent } from "@/lib/canvas/merge";

/**
 * Music publishing: a finished song (from the Songwriting Canvas) or a take
 * (from the Riff Vault) posted to the author's profile and the feed, with
 * credits. Only the owner of the song or riff publishes it; credits may name
 * the author and members of the project the music came from. The post keeps
 * a snapshot, so later edits to the song don't change what was released.
 */

export const MAX_CREDITS = 12;

export type ReleaseCredit = { userId: string; handle: string; name: string | null; role: string };
export type ReleaseTake = { id: string; mime: string; durationSec: number | null; peaks: number[] | null; label: string | null; mix?: string };
/** `takes`: the main mix first, then alternates. `take` is the main mix (kept for older readers). */
export type Release = { kind: "song" | "take"; title: string; key: string | null; bpm: number | null; chart: CanvasContent | null; take: ReleaseTake | null; takes: ReleaseTake[]; canvasId?: string | null; credits: ReleaseCredit[]; projectId: string | null };
export const MAX_MIXES = 6;
export type ReleaseInput = { canvasId: string | null; takeId: string | null; credits: { handle: string; role: string }[] };

const id = (v: unknown, field: string) => (v === undefined || v === null || v === "" ? null : typeof v === "string" && /^[a-z0-9]{10,40}$/.test(v) ? v : fail(`${field} is invalid.`));

export function parseReleaseInput(v: unknown): ReleaseInput {
  if (typeof v !== "object" || v === null) fail("release must be an object.");
  const r = v as Record<string, unknown>;
  const canvasId = id(r.canvasId, "canvasId");
  const takeId = id(r.takeId, "takeId");
  if (!canvasId && !takeId) fail("Publish a song, a take, or both.");
  const raw = r.credits ?? [];
  if (!Array.isArray(raw) || raw.length > MAX_CREDITS) fail(`Credit up to ${MAX_CREDITS} people.`);
  const credits = raw.map((c, i) => {
    const x = (c ?? {}) as Record<string, unknown>;
    const handle = typeof x.handle === "string" ? x.handle.replace(/^@/, "").trim().toLowerCase() : "";
    const role = typeof x.role === "string" ? x.role.trim() : "";
    if (!/^[a-z0-9_]{2,30}$/.test(handle)) fail(`Credit ${i + 1} needs a handle.`);
    if (!role || role.length > 40) fail(`Give credit ${i + 1} a role (up to 40 characters).`);
    return { handle, role };
  });
  return { canvasId, takeId, credits };
}

/** Everyone who has been in the project (left or not): they made the music, so they can be credited. */
async function projectPeople(projectId: string | null) {
  if (!projectId) return new Set<string>();
  const rows = await prisma.conversationMember.findMany({ where: { conversationId: projectId }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

/** Checks permissions and builds the snapshot stored on the post. */
export async function buildRelease(authorId: string, input: ReleaseInput): Promise<Release> {
  let chart: CanvasContent | null = null;
  let title = "";
  let key: string | null = null;
  let bpm: number | null = null;
  let projectId: string | null = null;
  if (input.canvasId) {
    const canvas = await getCanvas(authorId, input.canvasId);
    if (!canvas) throw new ApiError(404, "Song not found.");
    if (!canvas.isOwner) throw new ApiError(403, "Only the song's owner can publish it.");
    ({ title, key, bpm } = canvas);
    chart = { title: canvas.title, key: canvas.key, bpm: canvas.bpm, sections: canvas.sections, arrangement: canvas.arrangement };
    projectId = canvas.project?.id ?? null;
  }
  let take: ReleaseTake | null = null;
  if (input.takeId) {
    // Your own riff's take, or (publishing a project's song) a take from that project's riffs.
    const t = await prisma.riffTake.findFirst({
      where: { id: input.takeId, status: "READY", riff: { OR: [{ ownerId: authorId }, ...(projectId ? [{ projectId }] : [])] } },
      select: { id: true, mime: true, durationSec: true, peaks: true, label: true, riff: { select: { title: true, key: true, bpm: true, projectId: true, ownerId: true } } },
    });
    if (!t) throw new ApiError(403, "You can publish your own takes, or takes from the song's project.");
    take = { id: t.id, mime: t.mime, durationSec: t.durationSec, peaks: Array.isArray(t.peaks) ? (t.peaks as number[]) : null, label: t.label };
    if (!chart) ({ title, key, bpm } = t.riff);
    projectId ??= t.riff.projectId;
  }
  const people = await projectPeople(projectId);
  people.add(authorId);
  const users = input.credits.length ? await prisma.user.findMany({ where: { handle: { in: input.credits.map((c) => c.handle) } }, select: { id: true, handle: true, name: true } }) : [];
  const credits = input.credits.map((c) => {
    const u = users.find((x) => x.handle === c.handle);
    if (!u || !people.has(u.id)) fail(`@${c.handle} isn't in this project, so they can't be credited here.`);
    return { userId: u.id, handle: u.handle, name: u.name, role: c.role };
  });
  const takes = take ? [{ ...take, mix: "Main" }] : [];
  return { kind: chart ? "song" : "take", title, key, bpm, chart, take: takes[0] ?? null, takes, canvasId: input.canvasId, credits, projectId };
}

/** Post columns for a release (inside the post's create transaction). */
export const releaseData = (r: Release): Prisma.PostUpdateInput => ({
  release: r as unknown as Prisma.InputJsonValue,
  releaseTakeId: r.takes[0]?.id ?? null,
  releaseTakeIds: r.takes.map((t) => t.id),
  releaseProjectId: r.projectId,
});

/** A stored release, read leniently. */
export function readRelease(v: Prisma.JsonValue | null): Release | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as unknown as Release;
  if (typeof r.title !== "string" || (r.kind !== "song" && r.kind !== "take")) return null;
  // Releases published before alternate mixes have a single `take`.
  const takes = Array.isArray(r.takes) ? r.takes : r.take ? [{ ...r.take, mix: "Main" }] : [];
  return { ...r, takes, take: takes[0] ?? null, credits: Array.isArray(r.credits) ? r.credits : [] };
}

// ── Managing a published release ───────────────────────────────────────

type TakeChoice = { takeId: string; mix: string };
export function parseReleaseUpdate(body: Record<string, unknown>): { takes: TakeChoice[]; refreshChart: boolean; note: string | null } {
  if (!Array.isArray(body.takes) || body.takes.length > MAX_MIXES) fail(`A release has up to ${MAX_MIXES} mixes.`);
  const takes = body.takes.map((t, i) => {
    const x = (t ?? {}) as Record<string, unknown>;
    const takeId = id(x.takeId, `Mix ${i + 1}`);
    const mix = typeof x.mix === "string" ? x.mix.trim() : "";
    if (!takeId) fail(`Mix ${i + 1} needs a take.`);
    if (!mix || mix.length > 40) fail(`Name mix ${i + 1} (up to 40 characters).`);
    return { takeId, mix };
  });
  if (new Set(takes.map((t) => t.takeId)).size !== takes.length) fail("Each take can be in the release once.");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  return { takes, refreshChart: body.refreshChart === true, note };
}

async function ownRelease(authorId: string, postId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, authorId, status: { in: ["PUBLISHED", "HELD"] } }, select: { id: true, release: true } });
  const release = readRelease(post?.release ?? null);
  if (!post || !release) throw new ApiError(404, "Release not found.");
  return release;
}

/** Takes the author may put in this release: their own, or (for a project's release) the project's. */
const candidateWhere = (authorId: string, projectId: string | null): Prisma.RiffTakeWhereInput => ({ status: "READY", riff: { OR: [{ ownerId: authorId }, ...(projectId ? [{ projectId }] : [])] } });

export async function releaseCandidates(authorId: string, postId: string) {
  const release = await ownRelease(authorId, postId);
  const [takes, revisions] = await Promise.all([
    prisma.riffTake.findMany({ where: candidateWhere(authorId, release.projectId), orderBy: { createdAt: "desc" }, take: 60, select: { id: true, label: true, createdAt: true, riff: { select: { title: true } } } }),
    prisma.releaseRevision.findMany({ where: { postId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, note: true, createdAt: true, release: true } }),
  ]);
  return {
    release,
    candidates: takes.map((t) => ({ id: t.id, label: `${t.riff.title}${t.label ? ` · ${t.label}` : ""}`, createdAt: t.createdAt.toISOString() })),
    revisions: revisions.map((r) => ({ id: r.id, note: r.note, createdAt: r.createdAt.toISOString(), mixes: readRelease(r.release)?.takes.map((t) => t.mix ?? "Main") ?? [] })),
  };
}

async function writeRelease(postId: string, previous: Release, next: Release, note: string | null) {
  await prisma.$transaction([
    prisma.releaseRevision.create({ data: { postId, release: previous as unknown as Prisma.InputJsonValue, note } }),
    prisma.post.update({ where: { id: postId }, data: { ...releaseData(next), editedAt: new Date() } }),
  ]);
}

/** Change the mixes (order = main first), optionally refresh the lyrics and chords from the song. The old version is kept. */
export async function updateRelease(authorId: string, postId: string, input: ReturnType<typeof parseReleaseUpdate>) {
  const current = await ownRelease(authorId, postId);
  const rows = input.takes.length ? await prisma.riffTake.findMany({ where: { AND: [{ id: { in: input.takes.map((t) => t.takeId) } }, candidateWhere(authorId, current.projectId)] }, select: { id: true, mime: true, durationSec: true, peaks: true, label: true } }) : [];
  if (rows.length !== input.takes.length) throw new ApiError(403, "You can add your own takes, or takes from the release's project.");
  if (current.kind === "take" && !rows.length) fail("A recording release needs at least one take.");
  const takes = input.takes.map(({ takeId, mix }) => {
    const t = rows.find((r) => r.id === takeId)!;
    return { id: t.id, mime: t.mime, durationSec: t.durationSec, peaks: Array.isArray(t.peaks) ? (t.peaks as number[]) : null, label: t.label, mix };
  });
  let chart = current.chart;
  if (input.refreshChart) {
    const canvas = current.canvasId ? await getCanvas(authorId, current.canvasId) : null;
    if (!canvas?.isOwner) fail("The song this was released from isn't available to refresh from.");
    chart = { title: canvas.title, key: canvas.key, bpm: canvas.bpm, sections: canvas.sections, arrangement: canvas.arrangement };
  }
  await writeRelease(postId, current, { ...current, chart, takes, take: takes[0] ?? null }, input.note);
}

export async function restoreRelease(authorId: string, postId: string, revisionId: string) {
  const current = await ownRelease(authorId, postId);
  const rev = await prisma.releaseRevision.findFirst({ where: { id: revisionId, postId }, select: { release: true, createdAt: true } });
  const old = readRelease(rev?.release ?? null);
  if (!rev || !old) throw new ApiError(404, "Revision not found.");
  // Takes deleted since then can't come back.
  const alive = new Set((await prisma.riffTake.findMany({ where: { id: { in: old.takes.map((t) => t.id) }, status: "READY" }, select: { id: true } })).map((t) => t.id));
  const takes = old.takes.filter((t) => alive.has(t.id));
  await writeRelease(postId, current, { ...current, chart: old.chart, takes, take: takes[0] ?? null }, `Restored the version from ${rev.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`);
}
