import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";

/**
 * Live Listening Rooms: a project's current members listen to one of the
 * project's riff takes together. The server is the clock (see lib/rooms/sync).
 * Presence is a heartbeat: anyone not seen for a while has left; a room no
 * one has visited for half an hour closes itself.
 */

export const ROOM_REACTIONS = ["🔥", "👏", "🎯", "😍", "🤔", "🔁"] as const;
const PRESENT_MS = 25_000;
// Heartbeats only write when this much time has passed (polls come every 3–15 s).
const HEARTBEAT_WRITE_MS = 8000;
const ACTIVE_WRITE_MS = 60_000;
const IDLE_MS = 30 * 60_000;
const MAX_OPEN_ROOMS = 3;
const MAX_COMMENTS = 500;

type Person = { id: string; handle: string; name: string | null };
export type RoomTake = { id: string; riffId: string; riffTitle: string; label: string | null; src: string; mime: string; durationSec: number | null; peaks: number[] | null };
export type RoomComment = { id: string; author: Person; takeId: string | null; atSec: number; body: string | null; emoji: string | null; createdAt: string };
export type RoomState = {
  id: string; title: string; project: { id: string; title: string | null }; host: Person; isHost: boolean; canControl: boolean; anyoneControls: boolean;
  version: number; ended: boolean; take: RoomTake | null; playing: boolean; positionSec: number; stateAt: number; serverNow: number;
  present: Person[]; comments: RoomComment[]; takes: RoomTake[];
};
/** What a poll gets when nothing changed since the version it already has. */
export type RoomUnchanged = { unchanged: true; version: number; serverNow: number; presentIds: string[] };
export type RoomSummary = { id: string; title: string; host: Person; present: number; takeTitle: string | null; createdAt: string };

const PERSON = { select: { id: true, handle: true, name: true } } as const;

async function membership(userId: string, projectId: string) {
  const ok = await prisma.conversationMember.count({ where: { conversationId: projectId, userId, leftAt: null, conversation: { kind: "PROJECT" } } });
  if (!ok) throw new ApiError(404, "Room not found.");
}

async function roomFor(userId: string, id: string) {
  const room = await prisma.listeningRoom.findUnique({ where: { id } });
  if (!room) throw new ApiError(404, "Room not found.");
  await membership(userId, room.projectId);
  return room;
}

/** The project's playable takes (newest first). */
async function projectTakes(projectId: string): Promise<RoomTake[]> {
  const takes = await prisma.riffTake.findMany({
    where: { status: "READY", riff: { projectId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, label: true, mime: true, durationSec: true, peaks: true, riff: { select: { id: true, title: true } } },
  });
  return takes.map((t) => ({ id: t.id, riffId: t.riff.id, riffTitle: t.riff.title, label: t.label, src: `/api/riff-takes/${t.id}/audio`, mime: t.mime, durationSec: t.durationSec, peaks: Array.isArray(t.peaks) ? (t.peaks as number[]) : null }));
}

export async function createRoom(userId: string, input: { projectId?: unknown; title?: unknown; takeId?: unknown }) {
  if (typeof input.projectId !== "string") fail("Choose a project.");
  await membership(userId, input.projectId);
  // Rooms nobody visits close themselves; keep a project from accumulating open ones.
  await closeIdle(input.projectId);
  if ((await prisma.listeningRoom.count({ where: { projectId: input.projectId, endedAt: null } })) >= MAX_OPEN_ROOMS) throw new ApiError(409, "This project already has three open rooms. Join one, or end one first.");
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 80) : "Listening session";
  let takeId: string | null = null;
  if (typeof input.takeId === "string") takeId = (await assertProjectTake(input.projectId, input.takeId)).id;
  else takeId = (await projectTakes(input.projectId))[0]?.id ?? null;
  const room = await prisma.listeningRoom.create({ data: { projectId: input.projectId, hostId: userId, title, takeId, participants: { create: { userId } } }, select: { id: true } });
  return room.id;
}

async function assertProjectTake(projectId: string, takeId: string) {
  const take = await prisma.riffTake.findFirst({ where: { id: takeId, status: "READY", riff: { projectId } }, select: { id: true } });
  if (!take) fail("That take isn't in this project.");
  return take;
}

async function closeIdle(projectId: string) {
  await prisma.listeningRoom.updateMany({ where: { projectId, endedAt: null, lastActiveAt: { lt: new Date(Date.now() - IDLE_MS) } }, data: { endedAt: new Date(), playing: false } });
}

export async function listRooms(userId: string, projectId: string): Promise<RoomSummary[]> {
  await membership(userId, projectId);
  await closeIdle(projectId);
  const rooms = await prisma.listeningRoom.findMany({ where: { projectId, endedAt: null }, orderBy: { createdAt: "desc" }, include: { participants: { where: { lastSeenAt: { gt: new Date(Date.now() - PRESENT_MS) } }, select: { userId: true } } } });
  const hosts = await prisma.user.findMany({ where: { id: { in: rooms.map((r) => r.hostId) } }, ...PERSON });
  const takes = await prisma.riffTake.findMany({ where: { id: { in: rooms.flatMap((r) => (r.takeId ? [r.takeId] : [])) } }, select: { id: true, label: true, riff: { select: { title: true } } } });
  return rooms.map((r) => {
    const t = takes.find((x) => x.id === r.takeId);
    return { id: r.id, title: r.title, host: hosts.find((h) => h.id === r.hostId)!, present: r.participants.length, takeTitle: t ? `${t.riff.title}${t.label ? ` · ${t.label}` : ""}` : null, createdAt: r.createdAt.toISOString() };
  });
}

/**
 * One poll: records that this person is here (throttled), then returns the
 * room's clock, who's present and feedback since `since`; or, when the
 * caller already has the current version, just the clock and who's present.
 */
export async function syncRoom(userId: string, id: string, since: Date | null): Promise<RoomState>;
export async function syncRoom(userId: string, id: string, since: Date | null, knownVersion: number | null): Promise<RoomState | RoomUnchanged>;
export async function syncRoom(userId: string, id: string, since: Date | null, knownVersion: number | null = null): Promise<RoomState | RoomUnchanged> {
  let room = await roomFor(userId, id);
  const now = new Date();
  if (!room.endedAt && now.getTime() - room.lastActiveAt.getTime() > IDLE_MS) {
    room = await prisma.listeningRoom.update({ where: { id }, data: { endedAt: now, playing: false, version: { increment: 1 } } });
  }
  if (!room.endedAt) {
    const me = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: id, userId } }, select: { lastSeenAt: true } });
    if (!me || now.getTime() - me.lastSeenAt.getTime() > HEARTBEAT_WRITE_MS) await prisma.roomParticipant.upsert({ where: { roomId_userId: { roomId: id, userId } }, create: { roomId: id, userId, lastSeenAt: now }, update: { lastSeenAt: now } });
    if (now.getTime() - room.lastActiveAt.getTime() > ACTIVE_WRITE_MS) await prisma.listeningRoom.update({ where: { id }, data: { lastActiveAt: now } });
  }
  if (knownVersion === room.version) {
    const here = await prisma.roomParticipant.findMany({ where: { roomId: id, lastSeenAt: { gt: new Date(now.getTime() - PRESENT_MS) } }, select: { userId: true } });
    return { unchanged: true, version: room.version, serverNow: Date.now(), presentIds: here.map((p) => p.userId) };
  }
  const [present, comments, takes, host, project] = await Promise.all([
    prisma.roomParticipant.findMany({ where: { roomId: id, lastSeenAt: { gt: new Date(now.getTime() - PRESENT_MS) } }, select: { userId: true } }),
    prisma.roomComment.findMany({ where: { roomId: id, ...(since && { createdAt: { gt: since } }) }, orderBy: { createdAt: "asc" }, take: MAX_COMMENTS }),
    projectTakes(room.projectId),
    prisma.user.findUniqueOrThrow({ where: { id: room.hostId }, ...PERSON }),
    prisma.conversation.findUniqueOrThrow({ where: { id: room.projectId }, select: { id: true, title: true } }),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set([...present.map((p) => p.userId), ...comments.map((c) => c.authorId)])] } }, ...PERSON });
  const person = (pid: string) => people.find((p) => p.id === pid) ?? { id: pid, handle: "former-member", name: null };
  return {
    id: room.id, version: room.version, title: room.title, project, host, isHost: room.hostId === userId, canControl: !room.endedAt && (room.hostId === userId || room.anyoneControls), anyoneControls: room.anyoneControls,
    ended: !!room.endedAt, take: takes.find((t) => t.id === room.takeId) ?? null, playing: room.playing, positionSec: room.positionSec, stateAt: room.stateAt.getTime(), serverNow: Date.now(),
    present: present.map((p) => person(p.userId)),
    comments: comments.map((c) => ({ id: c.id, author: person(c.authorId), takeId: c.takeId, atSec: c.atSec, body: c.body, emoji: c.emoji, createdAt: c.createdAt.toISOString() })),
    takes,
  };
}

export type ControlInput = { action: "play" | "pause" | "seek" | "load"; positionSec?: number; takeId?: string };
export function parseControl(body: Record<string, unknown>): ControlInput {
  const action = body.action;
  if (action !== "play" && action !== "pause" && action !== "seek" && action !== "load") fail("Unknown action.");
  const positionSec = body.positionSec === undefined ? undefined : typeof body.positionSec === "number" && body.positionSec >= 0 && body.positionSec <= 3600 ? body.positionSec : fail("positionSec must be 0–3600.");
  const takeId = body.takeId === undefined ? undefined : typeof body.takeId === "string" && /^[a-z0-9]{10,40}$/.test(body.takeId) ? body.takeId : fail("takeId is invalid.");
  if (action === "load" && !takeId) fail("Say which take to load.");
  return { action, positionSec, takeId };
}

/** Play, pause, seek or change take, as the host (or anyone, when the host allows). Times are the server's. */
export async function controlRoom(userId: string, id: string, c: ControlInput) {
  const room = await roomFor(userId, id);
  if (room.endedAt) throw new ApiError(409, "This session has ended.");
  if (room.hostId !== userId && !room.anyoneControls) throw new ApiError(403, "Only the host controls playback in this room.");
  const now = new Date();
  const current = room.playing ? room.positionSec + (now.getTime() - room.stateAt.getTime()) / 1000 : room.positionSec;
  const data: Prisma.ListeningRoomUpdateInput = { stateAt: now, lastActiveAt: now, version: { increment: 1 } };
  if (c.action === "play") Object.assign(data, { playing: true, positionSec: c.positionSec ?? current });
  if (c.action === "pause") Object.assign(data, { playing: false, positionSec: c.positionSec ?? current });
  if (c.action === "seek") Object.assign(data, { positionSec: c.positionSec ?? 0 });
  if (c.action === "load") Object.assign(data, { takeId: (await assertProjectTake(room.projectId, c.takeId!)).id, playing: false, positionSec: 0 });
  await prisma.listeningRoom.update({ where: { id }, data });
}

export async function commentInRoom(userId: string, id: string, body: Record<string, unknown>) {
  const room = await roomFor(userId, id);
  if (room.endedAt) throw new ApiError(409, "This session has ended.");
  const atSec = typeof body.atSec === "number" && body.atSec >= 0 && body.atSec <= 3600 ? Math.round(body.atSec * 10) / 10 : fail("atSec must be 0–3600.");
  const emoji = body.emoji === undefined ? null : (ROOM_REACTIONS as readonly string[]).includes(body.emoji as string) ? (body.emoji as string) : fail("Pick one of the reactions offered.");
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!emoji && !text) fail("Write something, or pick a reaction.");
  if (text.length > 500) fail("Comments are at most 500 characters.");
  if ((await prisma.roomComment.count({ where: { roomId: id } })) >= MAX_COMMENTS) throw new ApiError(409, "This session has reached its comment limit.");
  await prisma.$transaction([
    prisma.roomComment.create({ data: { roomId: id, authorId: userId, takeId: room.takeId, atSec, body: emoji ? null : text, emoji } }),
    prisma.listeningRoom.update({ where: { id }, data: { version: { increment: 1 } } }),
  ]);
}

/** Host only: who may control playback, or end the session. */
export async function updateRoom(userId: string, id: string, body: Record<string, unknown>) {
  const room = await roomFor(userId, id);
  if (room.hostId !== userId) throw new ApiError(403, "Only the host can change the room.");
  const data: Prisma.ListeningRoomUpdateInput = {};
  if (body.anyoneControls !== undefined) data.anyoneControls = typeof body.anyoneControls === "boolean" ? body.anyoneControls : fail("anyoneControls must be true or false.");
  if (body.end === true) Object.assign(data, { endedAt: new Date(), playing: false });
  if (!Object.keys(data).length) fail("Nothing to change.");
  await prisma.listeningRoom.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
}
