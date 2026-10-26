import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { getPost, type PostView } from "@/lib/posts";
import { getTone, type ToneView } from "@/lib/tones";

/**
 * A musician's portfolio: what they're open to, who shaped their sound, the
 * gear they play and the post and tone they lead with. Pins are checked on
 * write (they must be the member's own, public work) and again on read, so a
 * post deleted or a tone made private later quietly drops off the profile.
 */

import { MAX_RIG, MAX_RIG_NOTE } from "@/lib/portfolio-options";

/** PUT /api/me/rig body: { items: [{ gearId, note? }] } in display order. */
export function parseRig(body: Record<string, unknown>): { gearId: string; note: string | null }[] {
  if (!Array.isArray(body.items)) fail("items must be a list.");
  if (body.items.length > MAX_RIG) fail(`List up to ${MAX_RIG} pieces of gear.`);
  const seen = new Set<string>();
  return body.items.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    if (typeof o.gearId !== "string" || !o.gearId || o.gearId.length > 40) fail("Each item needs a gearId.");
    if (seen.has(o.gearId)) fail("Each piece of gear can be listed once.");
    seen.add(o.gearId);
    if (o.note != null && typeof o.note !== "string") fail("Notes must be text.");
    const note = typeof o.note === "string" ? o.note.trim() : "";
    if (note.length > MAX_RIG_NOTE) fail(`Notes are at most ${MAX_RIG_NOTE} characters.`);
    return { gearId: o.gearId, note: note || null };
  });
}

/** Replaces the whole rig. Only catalog gear that's approved, or the member's own pending submission. */
export async function replaceRig(userId: string, items: { gearId: string; note: string | null }[]) {
  const found = await prisma.gearItem.findMany({
    where: { id: { in: items.map((i) => i.gearId) }, OR: [{ status: "APPROVED" }, { createdById: userId, status: "PENDING" }] },
    select: { id: true },
  });
  if (found.length !== items.length) throw new ApiError(400, "Some of that gear isn't in the catalog.");
  await prisma.$transaction([
    prisma.userGear.deleteMany({ where: { userId } }),
    prisma.userGear.createMany({ data: items.map((i, position) => ({ userId, gearItemId: i.gearId, note: i.note, position })) }),
  ]);
  return getRig(userId);
}

export type RigItem = Awaited<ReturnType<typeof getRig>>[number];

export function getRig(userId: string) {
  return prisma.userGear.findMany({
    where: { userId, gear: { status: { not: "REJECTED" } } },
    orderBy: { position: "asc" },
    select: { note: true, gear: { select: { id: true, slug: true, kind: true, brand: true, model: true } } },
  });
}

/** Pins must be the member's own published post and own public, credited tone. */
export async function assertOwnPins(userId: string, pins: { pinnedPostId?: string | null; signatureToneId?: string | null }) {
  if (pins.pinnedPostId) {
    const ok = await prisma.post.count({ where: { id: pins.pinnedPostId, authorId: userId, status: "PUBLISHED" } });
    if (!ok) throw new ApiError(400, "You can pin one of your own published posts.");
  }
  if (pins.signatureToneId) {
    // An anonymous tone would reveal its author if pinned to their profile.
    const ok = await prisma.tone.count({ where: { id: pins.signatureToneId, userId, visibility: "PUBLIC", anonymous: false } });
    if (!ok) throw new ApiError(400, "Your signature tone must be one of your public tones, shown under your name.");
  }
}

export type Showcase = { rig: RigItem[]; pinnedPost: PostView | null; signatureTone: ToneView | null };

/** The profile's showcase, re-checking every pin against what the viewer may see right now. */
export async function getShowcase(profileId: string, viewerId: string | null): Promise<Showcase> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: profileId }, select: { pinnedPostId: true, signatureToneId: true } });
  const [rig, post, tone] = await Promise.all([
    getRig(profileId),
    user.pinnedPostId ? getPost(user.pinnedPostId, viewerId) : null,
    user.signatureToneId ? getTone(user.signatureToneId, viewerId) : null,
  ]);
  return {
    rig,
    pinnedPost: post && post.author.id === profileId && post.status === "PUBLISHED" ? post : null,
    signatureTone: tone && tone.author.id === profileId && tone.visibility === "PUBLIC" && !tone.anonymous ? tone : null,
  };
}
