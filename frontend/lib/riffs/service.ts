import type { Prisma, RiffStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { getStorage } from "@/lib/storage";
import { viewableToneWhere } from "@/lib/tones";
import { SONG_KEYS } from "@/lib/song-keys";
import { extForMime, sniffRiffAudio } from "@/lib/riffs/sniff";

/**
 * Riff Vault: ideas and their recorded takes. Everything is private to the
 * owner; a riff turned into a collaboration project can be heard (not edited)
 * by that project's current members.
 */

export const RIFF_STAGES: RiffStage[] = ["IDEA", "DEVELOPING", "READY", "ARCHIVED"];
export const MAX_RIFFS = 300;
export const MAX_TAKES = 20;
export const MAX_TAKE_BYTES = 25 * 1024 * 1024;
export const MAX_TAKE_SECONDS = 600;
// shortcut: a flat per-member cap keeps the free storage tier safe; move to plan-based quotas if storage ever costs money.
export const RIFF_QUOTA_BYTES = 300 * 1024 * 1024;
const ABANDONED_MS = 24 * 3_600_000;

export type RiffTakeView = { id: string; label: string | null; durationSec: number | null; peaks: number[] | null; sizeBytes: number; mime: string; src: string; createdAt: string };
export type RiffSummary = { id: string; title: string; tags: string[]; key: string | null; bpm: number | null; stage: RiffStage; pinned: boolean; takes: number; lastTake: RiffTakeView | null; shared: boolean; owner: { handle: string; name: string | null } | null; updatedAt: string };
export type RiffView = RiffSummary & { notes: string | null; tone: { id: string; name: string } | null; project: { id: string; title: string | null } | null; canEdit: boolean; allTakes: RiffTakeView[] };
export type RiffInput = { title: string; notes: string | null; tags: string[]; key: string | null; bpm: number | null; stage: RiffStage; pinned: boolean; toneId: string | null };

// ── Validation ─────────────────────────────────────────────────────────

function title(v: unknown) {
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!t) fail("Give the riff a name.");
  if (t.length > 120) fail("Riff names are at most 120 characters.");
  return t;
}
function tags(v: unknown): string[] {
  if (!Array.isArray(v)) fail("tags must be a list.");
  const out = [...new Set(v.map((t) => (typeof t === "string" ? t.trim().toLowerCase().replace(/\s+/g, "-") : "")).filter(Boolean))];
  if (out.length > 10) fail("Use at most 10 tags.");
  for (const t of out) if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(t)) fail("Tags are short words: letters, numbers and dashes.");
  return out;
}
function optional<T>(v: unknown, parse: (v: unknown) => T): T | null {
  return v === undefined || v === null || v === "" ? null : parse(v);
}

export function parseRiffPatch(body: Record<string, unknown>, { create = false } = {}): Partial<RiffInput> {
  const out: Partial<RiffInput> = {};
  if (create || body.title !== undefined) out.title = title(body.title);
  if (body.notes !== undefined) out.notes = optional(body.notes, (v) => {
    if (typeof v !== "string") fail("notes must be text.");
    if (v.length > 4000) fail("Notes are at most 4000 characters.");
    return v.trim() || null;
  }) as string | null;
  if (body.tags !== undefined) out.tags = tags(body.tags);
  if (body.key !== undefined) out.key = optional(body.key, (v) => (typeof v === "string" && SONG_KEYS.includes(v) ? v : fail("key must be like C, F#, Bb or Am.")));
  if (body.bpm !== undefined) out.bpm = optional(body.bpm, (v) => (typeof v === "number" && Number.isInteger(v) && v >= 20 && v <= 300 ? v : fail("bpm must be a whole number from 20 to 300.")));
  if (body.stage !== undefined) out.stage = RIFF_STAGES.includes(body.stage as RiffStage) ? (body.stage as RiffStage) : fail("Unknown stage.");
  if (body.pinned !== undefined) out.pinned = typeof body.pinned === "boolean" ? body.pinned : fail("pinned must be true or false.");
  if (body.toneId !== undefined) out.toneId = optional(body.toneId, (v) => (typeof v === "string" && /^[a-z0-9]{10,40}$/.test(v) ? v : fail("toneId is invalid.")));
  if (!create && !Object.keys(out).length) fail("Nothing to change.");
  return out;
}

export function parseTakeStart(body: Record<string, unknown>) {
  const size = body.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) fail("size must be the recording's byte count.");
  if (size > MAX_TAKE_BYTES) throw new ApiError(413, "Takes are at most 25 MB (about 10 minutes of a browser recording).");
  const ext = typeof body.mime === "string" ? extForMime(body.mime) : null;
  if (!ext) fail("That audio format isn't supported. Record in the browser, or upload MP3, WAV, FLAC, M4A, WebM or Ogg.");
  const durationSec = optional(body.durationSec, (v) => (typeof v === "number" && v > 0 && v <= MAX_TAKE_SECONDS ? Math.round(v * 10) / 10 : fail("Takes are at most 10 minutes.")));
  const peaks = optional(body.peaks, (v) => {
    if (!Array.isArray(v) || v.length > 200 || !v.every((x) => typeof x === "number" && x >= 0 && x <= 1)) fail("peaks must be up to 200 numbers from 0 to 1.");
    return (v as number[]).map((x) => Math.round(x * 1000) / 1000);
  });
  const label = optional(body.label, (v) => (typeof v === "string" && v.trim().length <= 80 ? v.trim() || null : fail("Take labels are at most 80 characters.")));
  return { size, ext, durationSec, peaks, label };
}

// ── Access ─────────────────────────────────────────────────────────────

/** Riffs a viewer may open: their own, or riffs in projects they're an active member of. */
const viewableRiffWhere = (viewerId: string): Prisma.RiffWhereInput => ({
  OR: [{ ownerId: viewerId }, { project: { members: { some: { userId: viewerId, leftAt: null } } } }],
});

async function ownRiff(ownerId: string, id: string) {
  const riff = await prisma.riff.findFirst({ where: { id, ownerId }, select: { id: true, title: true, notes: true, projectId: true } });
  if (!riff) throw new ApiError(404, "Riff not found.");
  return riff;
}

async function assertToneUsable(ownerId: string, toneId: string | null | undefined) {
  if (!toneId) return;
  const ok = await prisma.tone.count({ where: { AND: [{ id: toneId }, viewableToneWhere(ownerId)] } });
  if (!ok) fail("That tone isn't available.");
}

// ── Views ──────────────────────────────────────────────────────────────

const TAKE_SELECT = { id: true, label: true, durationSec: true, peaks: true, sizeBytes: true, mime: true, createdAt: true } as const;
type TakeRow = { id: string; label: string | null; durationSec: number | null; peaks: Prisma.JsonValue; sizeBytes: number; mime: string; createdAt: Date };
const takeView = (t: TakeRow): RiffTakeView => ({
  id: t.id, label: t.label, durationSec: t.durationSec, sizeBytes: t.sizeBytes, mime: t.mime, createdAt: t.createdAt.toISOString(),
  peaks: Array.isArray(t.peaks) && t.peaks.every((x) => typeof x === "number") ? (t.peaks as number[]) : null,
  src: `/api/riff-takes/${t.id}/audio`,
});

const SUMMARY_SELECT = {
  id: true, title: true, tags: true, key: true, bpm: true, stage: true, pinned: true, ownerId: true, updatedAt: true,
  owner: { select: { handle: true, name: true } },
  _count: { select: { takes: { where: { status: "READY" as const } } } },
  takes: { where: { status: "READY" as const }, orderBy: { createdAt: "desc" as const }, take: 1, select: TAKE_SELECT },
} satisfies Prisma.RiffSelect;
type SummaryRow = Prisma.RiffGetPayload<{ select: typeof SUMMARY_SELECT }>;

const summary = (r: SummaryRow, viewerId: string): RiffSummary => ({
  id: r.id, title: r.title, tags: r.tags, key: r.key, bpm: r.bpm, stage: r.stage, pinned: r.pinned, takes: r._count.takes,
  lastTake: r.takes[0] ? takeView(r.takes[0]) : null, shared: r.ownerId !== viewerId,
  owner: r.ownerId === viewerId ? null : r.owner, updatedAt: r.updatedAt.toISOString(),
});

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  notes: true,
  tone: { select: { id: true, name: true, visibility: true, userId: true } },
  project: { select: { id: true, title: true } },
} satisfies Prisma.RiffSelect;

export async function listRiffs(viewerId: string, opts: { q?: string; tag?: string; stage?: RiffStage; projectId?: string } = {}): Promise<RiffSummary[]> {
  const rows = await prisma.riff.findMany({
    where: {
      AND: [
        viewableRiffWhere(viewerId),
        ...(opts.q ? [{ OR: [{ title: { contains: opts.q, mode: "insensitive" as const } }, { notes: { contains: opts.q, mode: "insensitive" as const } }] }] : []),
        ...(opts.tag ? [{ tags: { has: opts.tag } }] : []),
        ...(opts.projectId ? [{ projectId: opts.projectId }] : []),
        opts.stage ? { stage: opts.stage } : { stage: { not: "ARCHIVED" as const } },
      ],
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: MAX_RIFFS,
    select: SUMMARY_SELECT,
  });
  return rows.map((r) => summary(r, viewerId));
}

export async function getRiff(viewerId: string, id: string): Promise<RiffView | null> {
  const r = await prisma.riff.findFirst({ where: { AND: [{ id }, viewableRiffWhere(viewerId)] }, select: DETAIL_SELECT });
  if (!r) return null;
  const all = await prisma.riffTake.findMany({ where: { riffId: id, status: "READY" }, orderBy: { createdAt: "asc" }, select: TAKE_SELECT });
  const canEdit = r.ownerId === viewerId;
  // A private tone stays private: collaborators only see a tone they could open themselves.
  const tone = r.tone && (r.tone.visibility !== "PRIVATE" || r.tone.userId === viewerId) ? { id: r.tone.id, name: r.tone.name } : null;
  return { ...summary(r, viewerId), notes: r.notes, tone, project: r.project, canEdit, allTakes: all.map(takeView) };
}

// ── Writes ─────────────────────────────────────────────────────────────

export async function createRiff(ownerId: string, input: Partial<RiffInput>) {
  if ((await prisma.riff.count({ where: { ownerId } })) >= MAX_RIFFS) throw new ApiError(409, `The vault holds ${MAX_RIFFS} riffs. Archive or delete some first.`);
  await assertToneUsable(ownerId, input.toneId);
  const { id } = await prisma.riff.create({ data: { ownerId, title: input.title!, notes: input.notes ?? null, tags: input.tags ?? [], key: input.key ?? null, bpm: input.bpm ?? null, stage: input.stage ?? "IDEA", pinned: input.pinned ?? false, toneId: input.toneId ?? null }, select: { id: true } });
  return (await getRiff(ownerId, id))!;
}

export async function updateRiff(ownerId: string, id: string, patch: Partial<RiffInput>) {
  await ownRiff(ownerId, id);
  await assertToneUsable(ownerId, patch.toneId);
  await prisma.riff.update({ where: { id }, data: patch });
  return (await getRiff(ownerId, id))!;
}

export async function deleteRiff(ownerId: string, id: string) {
  await ownRiff(ownerId, id);
  const takes = await prisma.riffTake.findMany({ where: { riffId: id }, select: { storageKey: true } });
  await prisma.riff.delete({ where: { id } });
  // Rows first, bytes after: a failed removal leaves an orphaned file, never a take pointing at nothing.
  await Promise.allSettled(takes.map((t) => getStorage().remove(t.storageKey)));
}

/** Reserves a take and says where to send the bytes. */
export async function startTake(ownerId: string, riffId: string, req: ReturnType<typeof parseTakeStart>) {
  await ownRiff(ownerId, riffId);
  // Lazy cleanup: uploads that never completed stop counting after a day.
  const stale = await prisma.riffTake.findMany({ where: { ownerId, status: "UPLOADING", createdAt: { lt: new Date(Date.now() - ABANDONED_MS) } }, select: { id: true, storageKey: true } });
  if (stale.length) {
    await prisma.riffTake.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
    await Promise.allSettled(stale.map((t) => getStorage().remove(t.storageKey)));
  }
  if ((await prisma.riffTake.count({ where: { riffId } })) >= MAX_TAKES) throw new ApiError(409, `A riff keeps up to ${MAX_TAKES} takes. Delete one first.`);
  const { _sum } = await prisma.riffTake.aggregate({ where: { ownerId }, _sum: { sizeBytes: true } });
  if ((_sum.sizeBytes ?? 0) + req.size > RIFF_QUOTA_BYTES) throw new ApiError(413, "Your Riff Vault is full (300 MB). Delete some takes to record more.");
  const take = await prisma.riffTake.create({ data: { riffId, ownerId, label: req.label, storageKey: "pending", mime: "application/octet-stream", sizeBytes: req.size, durationSec: req.durationSec, peaks: req.peaks ?? undefined } });
  const storageKey = `riffs/${ownerId}/${take.id}.${req.ext}`;
  await prisma.riffTake.update({ where: { id: take.id }, data: { storageKey } });
  const storage = getStorage();
  const upload = storage.driver === "supabase"
    ? { method: "PUT", url: await storage.createUploadUrl(storageKey), headers: { "content-type": "application/octet-stream" } }
    : { method: "PUT", url: `/api/riff-takes/${take.id}/content`, headers: { "content-type": "application/octet-stream" } };
  return { id: take.id, upload };
}

export async function ownTake(ownerId: string, id: string) {
  const take = await prisma.riffTake.findFirst({ where: { id, ownerId } });
  if (!take) throw new ApiError(404, "Take not found.");
  return take;
}

/** After the bytes are stored: check size and real format, then make it playable. Idempotent. */
export async function completeTake(ownerId: string, id: string) {
  const take = await ownTake(ownerId, id);
  if (take.status === "READY") return take;
  const storage = getStorage();
  const stat = await storage.stat(take.storageKey);
  if (!stat) throw new ApiError(409, "The recording hasn't finished uploading.");
  const reject = async (status: number, message: string) => {
    await storage.remove(take.storageKey);
    await prisma.riffTake.delete({ where: { id } });
    throw new ApiError(status, message);
  };
  if (stat.size > take.sizeBytes || stat.size > MAX_TAKE_BYTES) await reject(413, "The recording is larger than declared.");
  const head = await storage.get(take.storageKey);
  const sniffed = head ? sniffRiffAudio(new Uint8Array(head.bytes.subarray(0, 4096))) : null;
  if (!sniffed || !take.storageKey.endsWith(`.${sniffed.ext}`)) await reject(415, "That file isn't a supported audio recording.");
  return prisma.riffTake.update({ where: { id }, data: { status: "READY", mime: sniffed!.mime, sizeBytes: stat.size } });
}

export async function renameTake(ownerId: string, id: string, label: string | null) {
  await ownTake(ownerId, id);
  await prisma.riffTake.update({ where: { id }, data: { label } });
}

export async function deleteTake(ownerId: string, id: string) {
  const take = await ownTake(ownerId, id);
  await prisma.riffTake.delete({ where: { id } });
  await getStorage().remove(take.storageKey).catch(() => {});
}

/** A take the viewer may hear (ready, and they own the riff or are in its project). */
export async function audibleTake(viewerId: string, id: string) {
  return prisma.riffTake.findFirst({ where: { id, status: "READY", riff: viewableRiffWhere(viewerId) }, select: { storageKey: true, mime: true } });
}

/**
 * Turns a riff into a collaboration project: a project conversation (the
 * owner its first member; they add others there) whose members can hear it.
 * Doing it twice returns the same project.
 */
export async function riffProject(ownerId: string, id: string) {
  const riff = await ownRiff(ownerId, id);
  if (riff.projectId) return { projectId: riff.projectId };
  const now = new Date();
  const projectId = await prisma.$transaction(async (tx) => {
    const project = await tx.conversation.create({
      data: { kind: "PROJECT", title: riff.title.slice(0, 120), brief: riff.notes?.slice(0, 280) || "Started from a riff in the Riff Vault.", createdById: ownerId, lastMessageAt: now, lastMessageAuthorId: ownerId, members: { create: [{ userId: ownerId, lastReadAt: now }] } },
      select: { id: true },
    });
    await tx.message.create({ data: { conversationId: project.id, authorId: ownerId, kind: "SYSTEM", body: `started this project from the riff “${riff.title}”. Members can listen to its takes in the Riff Vault.`, createdAt: now } });
    await tx.riff.update({ where: { id }, data: { projectId: project.id } });
    return project.id;
  });
  return { projectId };
}
