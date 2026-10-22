import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { follow, unfollow } from "@/lib/follows";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ handle: string }> };

async function target(handle: string, actorId: string) {
  const user = await prisma.user.findFirst({
    where: { handle: handle.toLowerCase(), status: { not: "BANNED" } },
    select: { id: true },
  });
  if (!user) throw new ApiError(404, "Musician not found.");
  if (user.id === actorId) throw new ApiError(400, "You can't follow yourself.");
  return user.id;
}

export const PUT = route<Ctx>("users.follow", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("follow", actor.id, RATE_LIMITS.follow);
  const id = await target((await params).handle, actor.id);
  const { created: _created, ...result } = await follow(actor.id, id);
  return NextResponse.json(result);
});

export const DELETE = route<Ctx>("users.unfollow", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("follow", actor.id, RATE_LIMITS.follow);
  const id = await target((await params).handle, actor.id);
  return NextResponse.json(await unfollow(actor.id, id));
});
