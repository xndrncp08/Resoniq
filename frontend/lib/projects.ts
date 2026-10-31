import type { ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";

/**
 * Music projects (PROJECT conversations) as a body of work: what's in them
 * and how far along they are. Members set the stage; until they do, a
 * suggestion is derived from the contents (and labelled as a suggestion).
 */

import { PROJECT_STAGES, STAGE_LABEL } from "@/lib/projects-shared";
export { PROJECT_STAGES, STAGE_LABEL };

export type ProjectCounts = { riffs: number; takes: number; songs: number; openRooms: number; feedback: number; published: number };
export type ProjectView = {
  id: string; title: string | null; brief: string | null; stage: ProjectStage; stageSet: boolean; completedAt: string | null; lastActivity: string;
  members: { id: string; handle: string; name: string | null; image: string | null }[]; counts: ProjectCounts;
};

/** The stage a project's contents suggest, for projects whose members haven't set one. */
export function suggestStage(c: ProjectCounts): ProjectStage {
  if (c.published > 0) return "RELEASED";
  if (c.feedback > 0 || c.openRooms > 0) return "REVIEWING";
  if (c.takes > 1 && c.songs > 0) return "RECORDING";
  if (c.songs > 0) return "WRITING";
  return "IDEA";
}

async function counts(projectIds: string[]): Promise<Map<string, ProjectCounts>> {
  const [riffs, takes, songs, rooms, feedback, published] = await Promise.all([
    prisma.riff.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _count: true }),
    prisma.riffTake.findMany({ where: { status: "READY", riff: { projectId: { in: projectIds } } }, select: { riff: { select: { projectId: true } } } }),
    prisma.songCanvas.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _count: true }),
    prisma.listeningRoom.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, endedAt: null }, _count: true }),
    prisma.roomComment.findMany({ where: { room: { projectId: { in: projectIds } } }, select: { room: { select: { projectId: true } } } }),
    prisma.post.groupBy({ by: ["releaseProjectId"], where: { releaseProjectId: { in: projectIds }, status: "PUBLISHED" }, _count: true }),
  ]);
  const out = new Map(projectIds.map((id) => [id, { riffs: 0, takes: 0, songs: 0, openRooms: 0, feedback: 0, published: 0 }]));
  for (const r of riffs) if (r.projectId) out.get(r.projectId)!.riffs = r._count;
  for (const t of takes) if (t.riff.projectId) out.get(t.riff.projectId)!.takes++;
  for (const s of songs) if (s.projectId) out.get(s.projectId)!.songs = s._count;
  for (const r of rooms) out.get(r.projectId)!.openRooms = r._count;
  for (const f of feedback) out.get(f.room.projectId)!.feedback++;
  for (const p of published) if (p.releaseProjectId) out.get(p.releaseProjectId)!.published = p._count;
  return out;
}

export async function listProjects(viewerId: string, ids?: string[]): Promise<ProjectView[]> {
  const rows = await prisma.conversation.findMany({
    where: { kind: "PROJECT", members: { some: { userId: viewerId, leftAt: null } }, ...(ids && { id: { in: ids } }) },
    orderBy: { lastMessageAt: "desc" },
    take: 60,
    select: { id: true, title: true, brief: true, stage: true, completedAt: true, lastMessageAt: true, members: { where: { leftAt: null }, select: { user: { select: { id: true, handle: true, name: true, image: true } } } } },
  });
  const c = await counts(rows.map((r) => r.id));
  return rows.map((r) => {
    const n = c.get(r.id)!;
    return { id: r.id, title: r.title, brief: r.brief, stage: r.stage ?? suggestStage(n), stageSet: !!r.stage, completedAt: r.completedAt?.toISOString() ?? null, lastActivity: r.lastMessageAt.toISOString(), members: r.members.map((m) => m.user), counts: n };
  });
}

export async function getProject(viewerId: string, id: string): Promise<ProjectView> {
  const [p] = await listProjects(viewerId, [id]);
  if (!p) throw new ApiError(404, "Project not found.");
  return p;
}

/** Any current member moves the project along (or marks it finished); the thread says who did. */
export async function setProjectStage(viewerId: string, id: string, body: Record<string, unknown>) {
  const p = await getProject(viewerId, id);
  const stage = body.stage === undefined ? p.stage : PROJECT_STAGES.includes(body.stage as ProjectStage) ? (body.stage as ProjectStage) : fail("Unknown stage.");
  const finished = body.finished === undefined ? !!p.completedAt : typeof body.finished === "boolean" ? body.finished : fail("finished must be true or false.");
  const completedAt = finished ? (p.completedAt ? new Date(p.completedAt) : new Date()) : null;
  const note = finished && !p.completedAt ? "marked the project finished." : !finished && p.completedAt ? "reopened the project." : stage !== p.stage || !p.stageSet ? `moved the project to ${STAGE_LABEL[stage]}.` : null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.conversation.update({ where: { id }, data: { stage, completedAt, ...(note && { lastMessageAt: now, lastMessageAuthorId: viewerId }) } });
    if (note) await tx.message.create({ data: { conversationId: id, authorId: viewerId, kind: "SYSTEM", body: note, createdAt: now } });
  });
  return getProject(viewerId, id);
}
