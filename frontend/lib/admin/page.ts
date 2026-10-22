import { notFound } from "next/navigation";
import { getActor, isSuspended, type Actor } from "@/lib/authz";
import { can, isStaff, type Permission } from "@/lib/permissions";

/**
 * Server-side gate for admin pages. Anyone without the permission gets a 404,
 * so the console's existence isn't advertised. API routes check again on every mutation.
 */
export async function requireStaffPage(permission?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor || actor.status === "BANNED" || isSuspended(actor) || !isStaff(actor.role)) notFound();
  if (permission && !can(actor.role, permission)) notFound();
  return actor;
}
