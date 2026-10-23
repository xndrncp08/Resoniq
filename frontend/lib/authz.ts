import type { AccountStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { can, type Permission } from "@/lib/permissions";

/**
 * The signed-in user as the database sees them right now. Sessions are JWTs,
 * so role and status are re-read on every call: a ban or demotion applies to
 * the very next request instead of when the token expires.
 */
export type Actor = { id: string; handle: string; role: Role; status: AccountStatus; suspendedUntil: Date | null };

export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, handle: true, role: true, status: true, suspendedUntil: true, sessionVersion: true, kind: true },
  });
  // Sessions issued before the last password reset are dead; system identities never act.
  if (!user || user.kind === "SYSTEM" || (user.sessionVersion ?? 0) !== (session?.user?.sv ?? 0)) return null;
  const { sessionVersion: _v, kind: _k, ...actor } = user;
  return actor;
}

/** Suspensions with an end date in the past no longer apply. */
export function isSuspended(actor: Pick<Actor, "status" | "suspendedUntil">, now = new Date()): boolean {
  return actor.status === "SUSPENDED" && (actor.suspendedUntil === null || actor.suspendedUntil > now);
}

export async function requireActor(opts: { write?: boolean; message?: string } = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new ApiError(401, opts.message ?? "Sign in required.");
  if (actor.status === "BANNED") throw new ApiError(403, "This account has been banned.");
  if (opts.write && isSuspended(actor)) {
    throw new ApiError(
      403,
      actor.suspendedUntil
        ? `This account is suspended until ${actor.suspendedUntil.toISOString().slice(0, 10)}.`
        : "This account is suspended.",
    );
  }
  return actor;
}

export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor({ write: true });
  if (!can(actor.role, permission)) throw new ApiError(403, "Not allowed.");
  return actor;
}
