import type { AccountStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { fail } from "@/lib/validation";

export const ROLES: Role[] = ["USER", "MODERATOR", "ADMIN"];
export const STATUSES: AccountStatus[] = ["ACTIVE", "SUSPENDED", "BANNED"];

export async function listUsers(q: { search?: string; status?: AccountStatus; role?: Role; page: number }) {
  const where: Prisma.UserWhereInput = {
    ...(q.status && { status: q.status }),
    ...(q.role && { role: q.role }),
    ...(q.search && {
      OR: [
        { handle: { contains: q.search.toLowerCase() } },
        { name: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
        { id: q.search },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: q.page * 50,
      take: 50,
      select: { id: true, handle: true, name: true, email: true, image: true, role: true, status: true, suspendedUntil: true, createdAt: true, reputation: true, _count: { select: { posts: true, reports: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total };
}

export async function userDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, handle: true, name: true, email: true, emailVerified: true, image: true, bio: true, role: true, status: true, suspendedUntil: true, statusReason: true,
      createdAt: true, reputation: true, followerCount: true, followingCount: true,
      _count: { select: { posts: true, comments: true, tones: true, media: true, reports: true } },
    },
  });
  if (!user) return null;
  const [reportsAgainst, audit, recentPosts] = await Promise.all([
    prisma.report.findMany({ where: { targetType: "USER", targetId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { reporter: { select: { handle: true } } } }),
    prisma.auditLog.findMany({ where: { targetType: "User", targetId: id }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { handle: true } } } }),
    prisma.post.findMany({ where: { authorId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true, body: true, status: true, createdAt: true, score: true } }),
  ]);
  return { user, reportsAgainst, audit, recentPosts };
}

export function parseStatusChange(body: Record<string, unknown>) {
  const status = body.status as AccountStatus;
  if (!STATUSES.includes(status)) fail("Unknown status.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (status !== "ACTIVE" && !reason) fail("Give a reason; the member sees it.");
  let until: Date | null = null;
  if (status === "SUSPENDED" && body.days !== undefined && body.days !== null) {
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) fail("Suspensions are 1–365 days, or open-ended.");
    until = new Date(Date.now() + days * 86_400_000);
  }
  return { status, reason, until };
}

/**
 * Suspend, ban or reinstate. Moderators can suspend and reinstate; only admins
 * ban. Nobody acts on themselves or on someone of equal or higher rank.
 */
export async function setUserStatus(actor: Actor, id: string, change: ReturnType<typeof parseStatusChange>) {
  const needed = change.status === "BANNED" ? "users.ban" : "users.suspend";
  if (!can(actor.role, needed)) throw new ApiError(403, "Not allowed.");
  if (id === actor.id) throw new ApiError(400, "You can't change your own account status.");
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, status: true } });
  if (!target) throw new ApiError(404, "User not found.");
  if (target.role !== "USER" && actor.role !== "ADMIN") throw new ApiError(403, "Only admins can act on staff accounts.");
  if (target.status === "BANNED" && change.status !== "BANNED" && !can(actor.role, "users.ban")) throw new ApiError(403, "Only admins can lift a ban.");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { status: change.status, suspendedUntil: change.status === "SUSPENDED" ? change.until : null, statusReason: change.status === "ACTIVE" ? null : change.reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: `user.${change.status.toLowerCase()}`,
      targetType: "User",
      targetId: id,
      reason: change.reason || undefined,
      meta: { from: target.status, until: change.until?.toISOString() ?? null },
    });
    if (change.status === "SUSPENDED") {
      await notify({ userId: id, type: "MODERATION", data: { action: "suspend", target: "account", reason: change.reason, until: change.until?.toISOString() ?? null } }, tx);
    }
  });
}

export async function setUserRole(actor: Actor, id: string, role: Role) {
  if (!can(actor.role, "users.roles")) throw new ApiError(403, "Not allowed.");
  if (!ROLES.includes(role)) throw new ApiError(400, "Unknown role.");
  if (id === actor.id) throw new ApiError(400, "Ask another admin to change your own role.");
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new ApiError(404, "User not found.");
    if (target.role === "ADMIN" && role !== "ADMIN") {
      const admins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (admins <= 1) throw new ApiError(400, "Resoniq needs at least one active admin.");
    }
    await tx.user.update({ where: { id }, data: { role } });
    await recordAudit(tx, { actorId: actor.id, action: "user.role.set", targetType: "User", targetId: id, meta: { from: target.role, to: role } });
  });
}
