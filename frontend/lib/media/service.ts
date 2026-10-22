import type { Media, MediaKind, MediaPurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { isEnabled } from "@/lib/flags";
import { enqueue } from "@/lib/jobs/queue";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { visiblePostWhere } from "@/lib/posts";
import { getStorage } from "@/lib/storage";
import { fail } from "@/lib/validation";
export { toMediaView, type MediaView } from "@/lib/media/view";
import { ACCEPTED_MIME, DAILY_UPLOAD_BYTES, MAX_ATTACHMENTS, MEDIA_LIMITS, REMOVED_RETENTION_MS } from "@/lib/media/limits";

export const MEDIA_KINDS: MediaKind[] = ["VIDEO", "AUDIO", "IMAGE"];
const PURPOSES: MediaPurpose[] = ["POST", "AVATAR", "BANNER"];

export type UploadRequest = { kind: MediaKind; size: number; mime: string; purpose: MediaPurpose; alt: string | null };

export function parseUploadRequest(body: Record<string, unknown>): UploadRequest {
  const kind = body.kind as MediaKind;
  if (!MEDIA_KINDS.includes(kind)) fail("kind must be VIDEO, AUDIO or IMAGE.");
  const purpose = (body.purpose ?? "POST") as MediaPurpose;
  if (!PURPOSES.includes(purpose)) fail("Unknown upload purpose.");
  if (purpose !== "POST" && kind !== "IMAGE") fail("Avatars and banners must be images.");
  const size = Number(body.size);
  if (!Number.isInteger(size) || size <= 0) fail("size must be the file's byte count.");
  if (size > MEDIA_LIMITS[kind].bytes) throw new ApiError(413, `${MEDIA_LIMITS[kind].label}.`);
  const mime = typeof body.mime === "string" ? body.mime.toLowerCase() : "";
  // A browser hint only, checked for a friendly early error; the bytes decide later.
  if (mime && !ACCEPTED_MIME[kind].includes(mime)) fail("That file type isn't supported.");
  const alt = typeof body.alt === "string" ? body.alt.trim().slice(0, 300) || null : null;
  return { kind, size, mime: mime || "application/octet-stream", purpose, alt };
}

export const originalKey = (ownerId: string, mediaId: string, ext: string) => `media/${ownerId}/${mediaId}/original.${ext}`;

/** Bytes this user started uploading in the last 24 hours (failed/removed uploads still count: they cost bandwidth). */
export async function uploadedLastDay(ownerId: string, now = new Date()): Promise<number> {
  const { _sum } = await prisma.media.aggregate({ where: { ownerId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } }, _sum: { sizeBytes: true } });
  return _sum.sizeBytes ?? 0;
}

export async function createUpload(actor: Actor, req: UploadRequest) {
  if (!(await isEnabled("uploads.enabled"))) throw new ApiError(503, "Uploads are paused right now.");
  if (req.kind === "VIDEO" && !(await isEnabled("uploads.video"))) throw new ApiError(503, "Video uploads are paused right now.");
  if ((await uploadedLastDay(actor.id)) + req.size > DAILY_UPLOAD_BYTES) {
    throw new ApiError(429, "You've reached today's upload allowance (3 GB). Try again tomorrow.");
  }
  const media = await prisma.media.create({
    data: { ownerId: actor.id, kind: req.kind, purpose: req.purpose, mime: req.mime, sizeBytes: req.size, alt: req.alt, originalKey: "pending" },
  });
  // The extension is nominal: the worker decides the real type from the bytes and records it in `mime`.
  const key = originalKey(actor.id, media.id, { VIDEO: "mp4", AUDIO: "m4a", IMAGE: "jpg" }[req.kind]);
  await prisma.media.update({ where: { id: media.id }, data: { originalKey: key } });
  const storage = getStorage();
  const upload =
    storage.driver === "supabase"
      ? { method: "PUT", url: await storage.createUploadUrl(key), headers: { "content-type": req.mime } }
      : { method: "PUT", url: `/api/media/${media.id}/content`, headers: { "content-type": "application/octet-stream" } };
  return { id: media.id, upload, limits: MEDIA_LIMITS[req.kind] };
}

export async function ownUpload(actor: Actor, id: string) {
  const media = await prisma.media.findFirst({ where: { id, ownerId: actor.id } });
  if (!media) throw new ApiError(404, "Upload not found.");
  return media;
}

/** After the bytes are stored: verify their size and queue processing. Idempotent. */
export async function completeUpload(actor: Actor, id: string) {
  const media = await ownUpload(actor, id);
  if (media.status !== "UPLOADING") return media;
  const stored = await getStorage().stat(media.originalKey);
  if (!stored) throw new ApiError(409, "The upload hasn't finished yet.");
  if (stored.size > MEDIA_LIMITS[media.kind].bytes || stored.size > media.sizeBytes) {
    await getStorage().remove(media.originalKey);
    await prisma.media.update({ where: { id }, data: { status: "FAILED", error: "The file is larger than declared." } });
    throw new ApiError(413, `${MEDIA_LIMITS[media.kind].label}.`);
  }
  return prisma.$transaction(async (tx) => {
    const m = await tx.media.update({ where: { id }, data: { status: "PROCESSING", sizeBytes: stored.size } });
    await enqueue("media.process", { mediaId: id }, { db: tx, maxAttempts: 3 });
    return m;
  });
}

/** Attaches the actor's own unattached post media, in order. Returns whether any is still processing. */
export async function attachMedia(tx: Prisma.TransactionClient, ownerId: string, postId: string, ids: string[]) {
  if (ids.length > MAX_ATTACHMENTS) throw new ApiError(400, `Attach up to ${MAX_ATTACHMENTS} files.`);
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "Each file can only be attached once.");
  const rows = await tx.media.findMany({ where: { id: { in: ids }, ownerId, purpose: "POST", postId: null, status: { in: ["PROCESSING", "READY"] } }, select: { id: true, status: true } });
  if (rows.length !== ids.length) throw new ApiError(400, "Some attachments aren't uploaded yet or can't be used.");
  for (const [position, id] of ids.entries()) await tx.media.update({ where: { id }, data: { postId, position } });
  return { processing: rows.some((r) => r.status === "PROCESSING") };
}

// ── Access ─────────────────────────────────────────────────────────────

export type MediaVariant = "playback" | "poster" | "preview" | "peaks";

/** Whether this viewer may fetch this media. Ready post media follows its post's visibility. */
export async function canViewMedia(media: Media, viewer: Actor | null): Promise<boolean> {
  if (viewer && (viewer.id === media.ownerId || can(viewer.role, "content.moderate"))) return true;
  if (media.status !== "READY") return false;
  if (media.purpose !== "POST") {
    const owner = await prisma.user.findUnique({ where: { id: media.ownerId }, select: { status: true } });
    return owner?.status !== "BANNED";
  }
  if (!media.postId) return false;
  return !!(await prisma.post.findFirst({ where: { AND: [{ id: media.postId }, visiblePostWhere(viewer?.id ?? null)] }, select: { id: true } }));
}

export function keyFor(media: Media, variant: MediaVariant): string | null {
  return { playback: media.playbackKey, poster: media.posterKey, preview: media.previewKey, peaks: media.peaksKey }[variant];
}

// ── Removal ────────────────────────────────────────────────────────────

/** Owner or moderator removal: blocked immediately, purged after the retention window. */
export async function removeMedia(actor: Actor, id: string, reason: string, opts: { asModerator: boolean }) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.status === "REMOVED") throw new ApiError(404, "Media not found.");
  if (opts.asModerator ? !can(actor.role, "content.moderate") : media.ownerId !== actor.id) throw new ApiError(404, "Media not found.");
  await prisma.$transaction(async (tx) => {
    await tx.media.update({ where: { id }, data: { status: "REMOVED", removedReason: reason, removedAt: new Date() } });
    await enqueue("media.purge", { mediaId: id }, { db: tx, runAt: new Date(Date.now() + (opts.asModerator ? REMOVED_RETENTION_MS : 0)) });
    if (opts.asModerator) {
      await tx.report.updateMany({ where: { targetType: "MEDIA", targetId: id, status: "OPEN" }, data: { status: "ACTIONED", resolvedById: actor.id, resolution: `Removed: ${reason}`, resolvedAt: new Date() } });
      await recordAudit(tx, { actorId: actor.id, action: "media.remove", targetType: "Media", targetId: id, reason, meta: { postId: media.postId } });
      await notify({ userId: media.ownerId, type: "MODERATION", postId: media.postId, data: { action: "remove", target: "media", reason, mediaId: id } }, tx);
    }
  });
}

/** Moderator restore within the retention window (e.g. an upheld appeal). */
export async function restoreMedia(actor: Actor, id: string) {
  if (!can(actor.role, "content.moderate")) throw new ApiError(403, "Not allowed.");
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.status !== "REMOVED" || !media.playbackKey) throw new ApiError(404, "Media can't be restored.");
  if (!(await getStorage().stat(media.playbackKey))) throw new ApiError(410, "This media has already been purged.");
  await prisma.$transaction(async (tx) => {
    await tx.media.update({ where: { id }, data: { status: "READY", removedReason: null, removedAt: null } });
    await tx.job.updateMany({ where: { type: "media.purge", status: "QUEUED", payload: { path: ["mediaId"], equals: id } }, data: { status: "SUCCEEDED", finishedAt: new Date(), lastError: "Cancelled: media restored" } });
    await recordAudit(tx, { actorId: actor.id, action: "media.restore", targetType: "Media", targetId: id });
  });
}
