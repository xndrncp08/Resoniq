import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { SONG_KEYS } from "@/lib/song-keys";
import { heartbeat, present } from "@/lib/presence";
import { SECTION_KINDS, type CanvasContent, type CanvasSection, type SectionKind } from "@/lib/canvas/merge";

/**
 * Songwriting Canvas: a song's words, chords, sections and arrangement.
 * Private to the owner unless it belongs to a project, whose current members
 * can edit it too. Saves name the version they started from; a stale save is
 * refused (409) and the client merges (lib/canvas/merge.ts) and retries.
 */

export const MAX_CANVASES = 200;
export const MAX_SECTIONS = 40;
export const MAX_REVISIONS = 100;
// Saves by the same person within this window refine one revision instead of adding another.
const REVISION_WINDOW_MS = 10 * 60_000;

export type CanvasView = CanvasContent & {
  id: string;
  version: number;
  canEdit: boolean;
  isOwner: boolean;
  project: { id: string; title: string | null } | null;
  owner: { handle: string; name: string | null };
  updatedBy: { handle: string; name: string | null } | null;
  updatedAt: string;
  /** Riffs the sections point to that this viewer may hear. */
  riffs: Record<string, { id: string; title: string; take: { id: string; src: string; mime: string; peaks: number[] | null; durationSec: number | null; label: string | null; sizeBytes: number; createdAt: string } | null }>;
};
export type CanvasSummary = { id: string; title: string; key: string | null; sections: number; project: { id: string; title: string | null } | null; shared: boolean; updatedAt: string };
export type RevisionView = { id: string; version: number; author: { handle: string; name: string | null } | null; title: string; createdAt: string; content: CanvasContent };

// ── Validation ─────────────────────────────────────────────────────────

const text = (v: unknown, field: string, max: number) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") fail(`${field} must be text.`);
  if (v.length > max) fail(`${field} is at most ${max} characters.`);
  return v;
};

function parseSection(raw: unknown, i: number): CanvasSection {
  if (typeof raw !== "object" || raw === null) fail(`Section ${i + 1} is invalid.`);
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || !/^[\w-]{1,40}$/.test(s.id)) fail(`Section ${i + 1} needs an id.`);
  if (!SECTION_KINDS.includes(s.kind as SectionKind)) fail(`Section ${i + 1} has an unknown kind.`);
  const name = text(s.name, `Section ${i + 1} name`, 60).trim() || String(s.kind);
  const out: CanvasSection = { id: s.id, kind: s.kind as SectionKind, name, lyrics: text(s.lyrics, `Section “${name}”`, 6000) };
  const notes = text(s.notes, `Notes for “${name}”`, 1000).trim();
  if (notes) out.notes = notes;
  if (s.bars !== undefined && s.bars !== null) {
    if (typeof s.bars !== "number" || !Number.isInteger(s.bars) || s.bars < 1 || s.bars > 256) fail(`Bars for “${name}” must be 1–256.`);
    out.bars = s.bars;
  }
  if (s.riffId !== undefined && s.riffId !== null && s.riffId !== "") {
    if (typeof s.riffId !== "string" || !/^[a-z0-9]{10,40}$/.test(s.riffId)) fail(`The riff on “${name}” is invalid.`);
    out.riffId = s.riffId;
  }
  return out;
}

export function parseContent(body: Record<string, unknown>): CanvasContent {
  const title = text(body.title, "Title", 120).trim();
  if (!title) fail("Give the song a title.");
  const key = body.key === null || body.key === undefined || body.key === "" ? null : SONG_KEYS.includes(body.key as string) ? (body.key as string) : fail("key must be like C, F#, Bb or Am.");
  const bpm = body.bpm === null || body.bpm === undefined || body.bpm === "" ? null : typeof body.bpm === "number" && Number.isInteger(body.bpm) && body.bpm >= 20 && body.bpm <= 300 ? body.bpm : fail("bpm must be 20–300.");
  if (!Array.isArray(body.sections) || body.sections.length > MAX_SECTIONS) fail(`A song has up to ${MAX_SECTIONS} sections.`);
  const sections = body.sections.map(parseSection);
  if (new Set(sections.map((s) => s.id)).size !== sections.length) fail("Each section needs its own id.");
  if (!Array.isArray(body.arrangement) || body.arrangement.length > 120) fail("The arrangement has up to 120 parts.");
  const ids = new Set(sections.map((s) => s.id));
  const arrangement = body.arrangement.map((id) => (typeof id === "string" && ids.has(id) ? id : fail("The arrangement refers to a section that doesn't exist.")));
  return { title, key, bpm, sections, arrangement };
}

/** Stored content read leniently (a bad row never breaks the page). */
function storedContent(r: { title: string; key: string | null; bpm: number | null; sections: Prisma.JsonValue; arrangement: Prisma.JsonValue }): CanvasContent {
  try {
    return parseContent({ title: r.title, key: r.key, bpm: r.bpm, sections: r.sections, arrangement: r.arrangement });
  } catch {
    const sections = (Array.isArray(r.sections) ? r.sections : []).flatMap((s, i) => { try { return [parseSection(s, i)]; } catch { return []; } });
    const ids = new Set(sections.map((s) => s.id));
    return { title: r.title, key: r.key, bpm: r.bpm, sections, arrangement: (Array.isArray(r.arrangement) ? r.arrangement : []).filter((id): id is string => typeof id === "string" && ids.has(id)) };
  }
}

// ── Access ─────────────────────────────────────────────────────────────

const memberOf = (viewerId: string): Prisma.ConversationWhereInput => ({ kind: "PROJECT", members: { some: { userId: viewerId, leftAt: null } } });
/** Owner, or a current member of the canvas's project. Both may edit. */
export const editableCanvasWhere = (viewerId: string): Prisma.SongCanvasWhereInput => ({ OR: [{ ownerId: viewerId }, { project: memberOf(viewerId) }] });

async function assertRiffsVisible(viewerId: string, sections: CanvasSection[], projectId: string | null) {
  const ids = [...new Set(sections.flatMap((s) => (s.riffId ? [s.riffId] : [])))];
  if (!ids.length) return;
  // A riff can be pinned to a section if this person may hear it.
  const n = await prisma.riff.count({ where: { id: { in: ids }, OR: [{ ownerId: viewerId }, { project: memberOf(viewerId) }, ...(projectId ? [{ projectId }] : [])] } });
  if (n !== ids.length) fail("One of the linked riffs isn't available to you.");
}

// ── Reads ──────────────────────────────────────────────────────────────

const VIEW_SELECT = {
  id: true, ownerId: true, title: true, key: true, bpm: true, sections: true, arrangement: true, version: true, updatedAt: true, updatedById: true,
  owner: { select: { handle: true, name: true } },
  project: { select: { id: true, title: true } },
} satisfies Prisma.SongCanvasSelect;

export async function getCanvas(viewerId: string, id: string): Promise<CanvasView | null> {
  const r = await prisma.songCanvas.findFirst({ where: { AND: [{ id }, editableCanvasWhere(viewerId)] }, select: VIEW_SELECT });
  if (!r) return null;
  const content = storedContent(r);
  const riffIds = [...new Set(content.sections.flatMap((s) => (s.riffId ? [s.riffId] : [])))];
  const [updatedBy, riffs] = await Promise.all([
    r.updatedById ? prisma.user.findUnique({ where: { id: r.updatedById }, select: { handle: true, name: true } }) : null,
    riffIds.length
      ? prisma.riff.findMany({
          where: { id: { in: riffIds }, OR: [{ ownerId: viewerId }, { project: memberOf(viewerId) }] },
          select: { id: true, title: true, takes: { where: { status: "READY" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, mime: true, peaks: true, durationSec: true, label: true, sizeBytes: true, createdAt: true } } },
        })
      : [],
  ]);
  return {
    ...content, id: r.id, version: r.version, canEdit: true, isOwner: r.ownerId === viewerId, project: r.project, owner: r.owner, updatedBy, updatedAt: r.updatedAt.toISOString(),
    riffs: Object.fromEntries(riffs.map((x) => {
      const t = x.takes[0];
      return [x.id, { id: x.id, title: x.title, take: t ? { id: t.id, src: `/api/riff-takes/${t.id}/audio`, mime: t.mime, peaks: Array.isArray(t.peaks) ? (t.peaks as number[]) : null, durationSec: t.durationSec, label: t.label, sizeBytes: t.sizeBytes, createdAt: t.createdAt.toISOString() } : null }];
    })),
  };
}

export async function listCanvases(viewerId: string, opts: { projectId?: string } = {}): Promise<CanvasSummary[]> {
  const rows = await prisma.songCanvas.findMany({
    where: { AND: [editableCanvasWhere(viewerId), ...(opts.projectId ? [{ projectId: opts.projectId }] : [])] },
    orderBy: { updatedAt: "desc" },
    take: MAX_CANVASES,
    select: { id: true, ownerId: true, title: true, key: true, sections: true, updatedAt: true, project: { select: { id: true, title: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, key: r.key, sections: Array.isArray(r.sections) ? r.sections.length : 0, project: r.project, shared: r.ownerId !== viewerId, updatedAt: r.updatedAt.toISOString() }));
}

// ── Writes ─────────────────────────────────────────────────────────────

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function assertProjectMember(userId: string, projectId: string) {
  const ok = await prisma.conversation.count({ where: { id: projectId, ...memberOf(userId) } });
  if (!ok) fail("You're not in that project.");
}

/** A new canvas, optionally in one of your projects, or started from a riff (it joins the riff's project). */
export async function createCanvas(ownerId: string, input: { title?: unknown; projectId?: unknown; fromRiffId?: unknown }) {
  if ((await prisma.songCanvas.count({ where: { ownerId } })) >= MAX_CANVASES) throw new ApiError(409, `You can keep up to ${MAX_CANVASES} songs. Delete some first.`);
  let projectId: string | null = null;
  let sections: CanvasSection[] = [{ id: "verse-1", kind: "verse", name: "Verse 1", lyrics: "" }, { id: "chorus-1", kind: "chorus", name: "Chorus", lyrics: "" }];
  let title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : "Untitled song";
  let key: string | null = null;
  let bpm: number | null = null;
  if (typeof input.fromRiffId === "string") {
    const riff = await prisma.riff.findFirst({ where: { id: input.fromRiffId, OR: [{ ownerId }, { project: memberOf(ownerId) }] }, select: { id: true, title: true, key: true, bpm: true, projectId: true, notes: true } });
    if (!riff) throw new ApiError(404, "Riff not found.");
    projectId = riff.projectId;
    title = riff.title;
    key = riff.key;
    bpm = riff.bpm;
    sections = [{ id: "riff-1", kind: "verse", name: "Verse 1", lyrics: "", riffId: riff.id, ...(riff.notes && { notes: riff.notes.slice(0, 1000) }) }, sections[1]];
  } else if (typeof input.projectId === "string") {
    await assertProjectMember(ownerId, input.projectId);
    projectId = input.projectId;
  }
  const c = await prisma.songCanvas.create({ data: { ownerId, projectId, title, key, bpm, sections: json(sections), arrangement: json(sections.map((s) => s.id)), updatedById: ownerId }, select: { id: true } });
  await prisma.songCanvasRevision.create({ data: { canvasId: c.id, version: 1, authorId: ownerId, title, key, bpm, sections: json(sections), arrangement: json(sections.map((s) => s.id)) } });
  return (await getCanvas(ownerId, c.id))!;
}

/** Saves content written from `baseVersion`. Refused with 409 if someone saved in between. */
export async function saveCanvas(viewerId: string, id: string, baseVersion: number, content: CanvasContent) {
  const canvas = await prisma.songCanvas.findFirst({ where: { AND: [{ id }, editableCanvasWhere(viewerId)] }, select: { id: true, projectId: true } });
  if (!canvas) throw new ApiError(404, "Song not found.");
  await assertRiffsVisible(viewerId, content.sections, canvas.projectId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.songCanvas.updateMany({
      where: { id, version: baseVersion },
      data: { title: content.title, key: content.key, bpm: content.bpm, sections: json(content.sections), arrangement: json(content.arrangement), version: { increment: 1 }, updatedById: viewerId },
    });
    if (!count) throw new ApiError(409, "Someone else saved this song meanwhile.");
    const latest = await tx.songCanvasRevision.findFirst({ where: { canvasId: id }, orderBy: { createdAt: "desc" }, select: { id: true, authorId: true, createdAt: true } });
    const data = { version: baseVersion + 1, title: content.title, key: content.key, bpm: content.bpm, sections: json(content.sections), arrangement: json(content.arrangement) };
    if (latest && latest.authorId === viewerId && now.getTime() - latest.createdAt.getTime() < REVISION_WINDOW_MS) await tx.songCanvasRevision.update({ where: { id: latest.id }, data });
    else await tx.songCanvasRevision.create({ data: { ...data, canvasId: id, authorId: viewerId } });
    const old = await tx.songCanvasRevision.findMany({ where: { canvasId: id }, orderBy: { createdAt: "desc" }, skip: MAX_REVISIONS, select: { id: true } });
    if (old.length) await tx.songCanvasRevision.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  });
  return (await getCanvas(viewerId, id))!;
}

export async function listRevisions(viewerId: string, id: string): Promise<RevisionView[]> {
  const canvas = await prisma.songCanvas.count({ where: { AND: [{ id }, editableCanvasWhere(viewerId)] } });
  if (!canvas) throw new ApiError(404, "Song not found.");
  const rows = await prisma.songCanvasRevision.findMany({ where: { canvasId: id }, orderBy: { createdAt: "desc" }, take: MAX_REVISIONS });
  const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => (r.authorId ? [r.authorId] : [])))] } }, select: { id: true, handle: true, name: true } });
  const byId = new Map(authors.map((a) => [a.id, { handle: a.handle, name: a.name }]));
  return rows.map((r) => ({ id: r.id, version: r.version, author: r.authorId ? (byId.get(r.authorId) ?? null) : null, title: r.title, createdAt: r.updatedAt.toISOString(), content: storedContent(r) }));
}

/** Owner only: move the song into one of their projects, or make it private again. */
export async function setCanvasProject(ownerId: string, id: string, projectId: string | null) {
  const c = await prisma.songCanvas.findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!c) throw new ApiError(404, "Song not found.");
  if (projectId) await assertProjectMember(ownerId, projectId);
  await prisma.songCanvas.update({ where: { id }, data: { projectId } });
  return (await getCanvas(ownerId, id))!;
}

export async function deleteCanvas(ownerId: string, id: string) {
  const { count } = await prisma.songCanvas.deleteMany({ where: { id, ownerId } });
  if (!count) throw new ApiError(404, "Song not found.");
}

export type CanvasPresence = { version: number; present: { id: string; handle: string; name: string | null; sectionId: string | null }[] };

/** The editor's poll: says where this person is (a section id, or none), and returns the song's version and who else is here. */
export async function canvasPresence(viewerId: string, id: string, sectionId: string | null): Promise<CanvasPresence> {
  const canvas = await prisma.songCanvas.findFirst({ where: { AND: [{ id }, editableCanvasWhere(viewerId)] }, select: { version: true } });
  if (!canvas) throw new ApiError(404, "Song not found.");
  await heartbeat(`canvas:${id}`, viewerId, sectionId);
  const here = (await present(`canvas:${id}`)).filter((p) => p.userId !== viewerId);
  const people = here.length ? await prisma.user.findMany({ where: { id: { in: here.map((p) => p.userId) } }, select: { id: true, handle: true, name: true } }) : [];
  return { version: canvas.version, present: here.flatMap((p) => { const u = people.find((x) => x.id === p.userId); return u ? [{ ...u, sectionId: p.detail }] : []; }) };
}
