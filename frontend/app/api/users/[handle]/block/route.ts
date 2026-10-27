import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { userIdForHandle } from "@/lib/handle-lookup";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ handle: string }> };

/** Block: neither of you can message the other; existing direct conversations disappear for both. */
export const PUT = route<Ctx>("users.block", async (_req, { params }) => {
  const actor = await requireActor();
  await enforceRateLimit("follow", actor.id, RATE_LIMITS.follow);
  const id = await userIdForHandle((await params).handle);
  if (id === actor.id) throw new ApiError(400, "You can't block yourself.");
  await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: actor.id, blockedId: id } }, create: { blockerId: actor.id, blockedId: id }, update: {} });
  return NextResponse.json({ blocked: true });
});

export const DELETE = route<Ctx>("users.unblock", async (_req, { params }) => {
  const actor = await requireActor();
  const id = await userIdForHandle((await params).handle);
  await prisma.block.deleteMany({ where: { blockerId: actor.id, blockedId: id } });
  return NextResponse.json({ blocked: false });
});
