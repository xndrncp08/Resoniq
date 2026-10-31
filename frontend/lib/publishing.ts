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
export type ReleaseTake = { id: string; mime: string; durationSec: number | null; peaks: number[] | null; label: string | null };
export type Release = { kind: "song" | "take"; title: string; key: string | null; bpm: number | null; chart: CanvasContent | null; take: ReleaseTake | null; credits: ReleaseCredit[]; projectId: string | null };
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
  return { kind: chart ? "song" : "take", title, key, bpm, chart, take, credits, projectId };
}

/** Post columns for a release (inside the post's create transaction). */
export const releaseData = (r: Release): Prisma.PostUpdateInput => ({
  release: r as unknown as Prisma.InputJsonValue,
  releaseTakeId: r.take?.id ?? null,
  releaseProjectId: r.projectId,
});

/** A stored release, read leniently. */
export function readRelease(v: Prisma.JsonValue | null): Release | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as unknown as Release;
  return typeof r.title === "string" && (r.kind === "song" || r.kind === "take") ? { ...r, credits: Array.isArray(r.credits) ? r.credits : [] } : null;
}
