import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { MAX_BPM, MIN_BPM } from "@/lib/practice";

/**
 * Tempo ladder: pick a passage, set the tempo you're working toward, and log
 * the tempos you play it at. Passages are private to their owner.
 */

export const MAX_PASSAGES = 30;
export const MAX_TAKES_PER_PASSAGE = 500;
/** How much history a ladder draws. */
export const TAKES_SHOWN = 40;

export type TakeView = { id: string; bpm: number; clean: boolean; createdAt: string };
export type PassageView = { id: string; title: string; targetBpm: number; updatedAt: string; takes: TakeView[] };

function bpm(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < MIN_BPM || v > MAX_BPM) fail(`${field} must be a whole number from ${MIN_BPM} to ${MAX_BPM}.`);
  return v;
}

function title(v: unknown): string {
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!t) fail("Name the passage you're working on.");
  if (t.length > 120) fail("Keep the passage name under 120 characters.");
  return t;
}

export function parsePassage(body: Record<string, unknown>): { title: string; targetBpm: number } {
  return { title: title(body.title), targetBpm: bpm(body.targetBpm, "Target tempo") };
}

export function parsePassagePatch(body: Record<string, unknown>): { title?: string; targetBpm?: number } {
  const patch: { title?: string; targetBpm?: number } = {};
  if (body.title !== undefined) patch.title = title(body.title);
  if (body.targetBpm !== undefined) patch.targetBpm = bpm(body.targetBpm, "Target tempo");
  if (!Object.keys(patch).length) fail("Nothing to change.");
  return patch;
}

export function parseTake(body: Record<string, unknown>): { bpm: number; clean: boolean } {
  if (typeof body.clean !== "boolean") fail("Say whether the take was clean.");
  return { bpm: bpm(body.bpm, "Tempo"), clean: body.clean };
}

const PASSAGE_SELECT = {
  id: true,
  title: true,
  targetBpm: true,
  updatedAt: true,
  takes: { orderBy: { createdAt: "desc" as const }, take: TAKES_SHOWN, select: { id: true, bpm: true, clean: true, createdAt: true } },
};

type PassageRow = { id: string; title: string; targetBpm: number; updatedAt: Date; takes: { id: string; bpm: number; clean: boolean; createdAt: Date }[] };

function view(p: PassageRow): PassageView {
  return {
    id: p.id,
    title: p.title,
    targetBpm: p.targetBpm,
    updatedAt: p.updatedAt.toISOString(),
    // Oldest first, the order a ladder is read in.
    takes: p.takes.map((t) => ({ id: t.id, bpm: t.bpm, clean: t.clean, createdAt: t.createdAt.toISOString() })).reverse(),
  };
}

export async function listPassages(userId: string): Promise<PassageView[]> {
  const rows = await prisma.practicePassage.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: MAX_PASSAGES, select: PASSAGE_SELECT });
  return rows.map(view);
}

export async function createPassage(userId: string, input: { title: string; targetBpm: number }): Promise<PassageView> {
  return prisma.$transaction(async (tx) => {
    if ((await tx.practicePassage.count({ where: { userId } })) >= MAX_PASSAGES) fail(`You can keep up to ${MAX_PASSAGES} passages. Remove one you've mastered first.`);
    return view(await tx.practicePassage.create({ data: { userId, ...input }, select: PASSAGE_SELECT }));
  });
}

// Every write is scoped by owner: someone else's id looks exactly like a missing one.
const notFound = () => new ApiError(404, "That passage doesn't exist.");

export async function updatePassage(userId: string, id: string, patch: { title?: string; targetBpm?: number }): Promise<PassageView> {
  const { count } = await prisma.practicePassage.updateMany({ where: { id, userId }, data: patch });
  if (!count) throw notFound();
  return view(await prisma.practicePassage.findUniqueOrThrow({ where: { id }, select: PASSAGE_SELECT }));
}

export async function deletePassage(userId: string, id: string) {
  const { count } = await prisma.practicePassage.deleteMany({ where: { id, userId } });
  if (!count) throw notFound();
}

export async function addTake(userId: string, passageId: string, take: { bpm: number; clean: boolean }): Promise<TakeView> {
  return prisma.$transaction(async (tx) => {
    const passage = await tx.practicePassage.findFirst({ where: { id: passageId, userId }, select: { id: true, _count: { select: { takes: true } } } });
    if (!passage) throw notFound();
    if (passage._count.takes >= MAX_TAKES_PER_PASSAGE) fail("This passage has a full history. Start a new one for the next stage.");
    const row = await tx.practiceTake.create({ data: { passageId, ...take }, select: { id: true, bpm: true, clean: true, createdAt: true } });
    await tx.practicePassage.update({ where: { id: passageId }, data: { updatedAt: new Date() } });
    return { ...row, createdAt: row.createdAt.toISOString() };
  });
}

export async function deleteTake(userId: string, takeId: string) {
  const { count } = await prisma.practiceTake.deleteMany({ where: { id: takeId, passage: { userId } } });
  if (!count) throw new ApiError(404, "That take doesn't exist.");
}
