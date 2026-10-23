import type { CommunityKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuspended, type Actor } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { isEnabled } from "@/lib/flags";
import { emailRequiredForSignup } from "@/lib/hosting";
import { fail } from "@/lib/validation";
import { RESERVED_HANDLES } from "@/lib/handles";

export const COMMUNITY_KINDS: CommunityKind[] = ["GENRE", "INSTRUMENT", "GEAR", "STYLE", "TOPIC"];
export const MIN_ACCOUNT_AGE_DAYS = 7;
export const MAX_CREATED_PER_30_DAYS = 2;
const SLUG = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export type CommunityRule = { title: string; body: string };
export type CommunityInput = { slug: string; name: string; description: string; kind: CommunityKind; rules: CommunityRule[] };

export const slugify = (name: string) =>
  name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");

function parseRules(v: unknown): CommunityRule[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 10) fail("Up to 10 rules.");
  return v.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const body = typeof o.body === "string" ? o.body.trim() : "";
    if (!title || title.length > 80 || body.length > 500) fail("Rules need a title (≤ 80) and an optional description (≤ 500).");
    return { title, body };
  });
}

export function parseCommunityInput(body: Record<string, unknown>): CommunityInput {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 3 || name.length > 40) fail("Community names are 3–40 characters.");
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().toLowerCase() : slugify(name);
  if (!SLUG.test(slug)) fail("Community addresses are 3–30 lowercase letters, numbers and dashes.");
  if (RESERVED_HANDLES.has(slug) || slug === "new") fail("That address is reserved.");
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) fail("Descriptions are at most 500 characters.");
  const kind = (body.kind ?? "TOPIC") as CommunityKind;
  if (!COMMUNITY_KINDS.includes(kind)) fail("Unknown community type.");
  return { slug, name, description, kind, rules: parseRules(body.rules) };
}

export function parseCommunityPatch(body: Record<string, unknown>): Partial<Pick<CommunityInput, "description" | "rules" | "name">> {
  const out: Partial<Pick<CommunityInput, "description" | "rules" | "name">> = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 3 || name.length > 40) fail("Community names are 3–40 characters.");
    out.name = name;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim().length > 500) fail("Descriptions are at most 500 characters.");
    out.description = body.description.trim();
  }
  if (body.rules !== undefined) out.rules = parseRules(body.rules);
  return out;
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

/**
 * Who may create a community: staff always; members whose account is at
 * least 7 days old, not suspended, (verified when that's enforced), and who
 * haven't created 2 communities in the last 30 days. Admins see every new
 * community in the console and can archive it.
 */
export async function canCreateCommunity(actor: Actor & { createdAt?: Date }, now = new Date()): Promise<Eligibility> {
  if (can(actor.role, "communities.manage")) return { ok: true };
  if (!(await isEnabled("community.userCreation"))) return { ok: false, reason: "Community creation is paused right now." };
  if (isSuspended(actor, now)) return { ok: false, reason: "Suspended accounts can't create communities." };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true, emailVerified: true, passwordHash: true } });
  const ageDays = (now.getTime() - user.createdAt.getTime()) / 86_400_000;
  if (ageDays < MIN_ACCOUNT_AGE_DAYS) {
    return { ok: false, reason: `Accounts can create communities after ${MIN_ACCOUNT_AGE_DAYS} days.` };
  }
  if ((emailRequiredForSignup() || (await isEnabled("auth.requireEmailVerification"))) && user.passwordHash && !user.emailVerified) {
    return { ok: false, reason: "Verify your email to create a community." };
  }
  const recent = await prisma.community.count({
    where: { createdById: actor.id, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
  });
  if (recent >= MAX_CREATED_PER_30_DAYS) return { ok: false, reason: `You can create ${MAX_CREATED_PER_30_DAYS} communities every 30 days.` };
  return { ok: true };
}

export async function isCommunityModerator(userId: string, communityId: string | null, db: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!communityId) return false;
  const m = await db.communityMember.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { role: true } });
  return m?.role === "MODERATOR";
}

export const COMMUNITY_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  kind: true,
  rules: true,
  memberCount: true,
  postCount: true,
  archivedAt: true,
  createdAt: true,
} satisfies Prisma.CommunitySelect;

export async function join(userId: string, communityId: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.communityMember.createMany({ data: [{ userId, communityId }], skipDuplicates: true });
    if (count) await tx.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
    return (await tx.community.findUniqueOrThrow({ where: { id: communityId }, select: { memberCount: true } })).memberCount;
  });
}

export async function leave(userId: string, communityId: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.communityMember.deleteMany({ where: { userId, communityId } });
    if (count) await tx.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } });
    return (await tx.community.findUniqueOrThrow({ where: { id: communityId }, select: { memberCount: true } })).memberCount;
  });
}
