import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

/** A member's id from their handle (with or without @), or a 404. */
export async function userIdForHandle(handle: unknown) {
  if (typeof handle !== "string") throw new ApiError(400, "Say who, by handle.");
  const u = await prisma.user.findFirst({ where: { handle: handle.trim().replace(/^@/, "").toLowerCase(), status: { not: "BANNED" }, kind: "PERSON" }, select: { id: true } });
  if (!u) throw new ApiError(404, "Musician not found.");
  return u.id;
}
