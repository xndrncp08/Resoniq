import type { FeaturedKind, FeaturedPlacement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { COMMUNITY_SELECT } from "@/lib/communities";
import { POST_VIEW_SELECT, visiblePostWhere, withViewerState } from "@/lib/posts";
import { AUTHOR_SELECT } from "@/lib/profiles";
import { getToneRows, listedToneWhere, toToneView } from "@/lib/tones";
import { fail } from "@/lib/validation";

export const PLACEMENTS: FeaturedPlacement[] = ["LANDING", "HOME", "EXPLORE"];
export const KINDS: FeaturedKind[] = ["POST", "TONE", "USER", "COMMUNITY"];

export function parseSlot(body: Record<string, unknown>) {
  const placement = body.placement as FeaturedPlacement;
  const kind = body.kind as FeaturedKind;
  if (!PLACEMENTS.includes(placement) || !KINDS.includes(kind)) fail("Pick a placement and a type.");
  const raw = typeof body.target === "string" ? body.target.trim() : "";
  if (!raw) fail("Paste a link, handle or id.");
  const position = Number(body.position ?? 0);
  const days = body.days === undefined || body.days === null || body.days === "" ? null : Number(body.days);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) fail("Run for 1–365 days, or leave blank.");
  return { placement, kind, raw, position: Number.isFinite(position) ? Math.trunc(position) : 0, note: typeof body.note === "string" ? body.note.slice(0, 200) : null, endsAt: days ? new Date(Date.now() + days * 86_400_000) : null };
}

/** Resolves "/p/abc", "https://…/t/xyz", "@handle" or "c/slug" to an id, requiring it to be publicly visible. */
async function resolveTarget(kind: FeaturedKind, raw: string): Promise<string> {
  const last = raw.replace(/\/+$/, "").split("/").pop()!.replace(/^@/, "");
  const found =
    kind === "POST" ? await prisma.post.findFirst({ where: { AND: [{ id: last }, visiblePostWhere(null)] }, select: { id: true } })
    : kind === "TONE" ? await prisma.tone.findFirst({ where: { AND: [{ id: last }, listedToneWhere] }, select: { id: true } })
    : kind === "USER" ? await prisma.user.findFirst({ where: { OR: [{ id: last }, { handle: last.toLowerCase() }], status: "ACTIVE" }, select: { id: true } })
    : await prisma.community.findFirst({ where: { OR: [{ id: last }, { slug: last.toLowerCase() }], archivedAt: null }, select: { id: true } });
  if (!found) throw new ApiError(400, "That isn't public (or doesn't exist). Only public content can be featured.");
  return found.id;
}

export async function addSlot(actor: Actor, input: ReturnType<typeof parseSlot>) {
  const targetId = await resolveTarget(input.kind, input.raw);
  return prisma.$transaction(async (tx) => {
    const slot = await tx.featuredSlot.create({ data: { placement: input.placement, kind: input.kind, targetId, position: input.position, note: input.note, endsAt: input.endsAt, createdById: actor.id } });
    await recordAudit(tx, { actorId: actor.id, action: "featured.add", targetType: input.kind, targetId, meta: { placement: input.placement } });
    return slot;
  });
}

export async function removeSlot(actor: Actor, id: string) {
  await prisma.$transaction(async (tx) => {
    const slot = await tx.featuredSlot.delete({ where: { id } }).catch(() => null);
    if (!slot) throw new ApiError(404, "Not found.");
    await recordAudit(tx, { actorId: actor.id, action: "featured.remove", targetType: slot.kind, targetId: slot.targetId, meta: { placement: slot.placement } });
  });
}

/** What a placement shows right now: only live slots whose targets are still public. */
export async function featured(placement: FeaturedPlacement, viewerId: string | null) {
  const now = new Date();
  const slots = await prisma.featuredSlot.findMany({
    where: { placement, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
  const ids = (k: FeaturedKind) => slots.filter((s) => s.kind === k).map((s) => s.targetId);
  const [postRows, toneRows, users, communities] = await Promise.all([
    prisma.post.findMany({ where: { AND: [{ id: { in: ids("POST") } }, visiblePostWhere(null)] }, select: POST_VIEW_SELECT }),
    getToneRows(ids("TONE")).then((rows) => rows.filter((t) => t.visibility === "PUBLIC" && t.user.status !== "BANNED")),
    prisma.user.findMany({ where: { id: { in: ids("USER") }, status: "ACTIVE" }, select: { ...AUTHOR_SELECT, bio: true, followerCount: true, instruments: true } }),
    prisma.community.findMany({ where: { id: { in: ids("COMMUNITY") }, archivedAt: null }, select: COMMUNITY_SELECT }),
  ]);
  const posts = await withViewerState(postRows, viewerId);
  return {
    posts: ids("POST").flatMap((id) => posts.filter((p) => p.id === id)),
    tones: ids("TONE").flatMap((id) => toneRows.filter((t) => t.id === id).map((t) => toToneView(t, viewerId))),
    users: ids("USER").flatMap((id) => users.filter((u) => u.id === id)),
    communities: ids("COMMUNITY").flatMap((id) => communities.filter((c) => c.id === id)),
  };
}
