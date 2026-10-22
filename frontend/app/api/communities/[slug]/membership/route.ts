import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { join, leave } from "@/lib/communities";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const c = await prisma.community.findUnique({ where: { slug: slug.toLowerCase() }, select: { id: true, archivedAt: true } });
  if (!c) throw new ApiError(404, "Community not found.");
  return c;
}

export const PUT = route<Ctx>("communities.join", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("follow", actor.id, RATE_LIMITS.follow);
  const c = await find((await params).slug);
  if (c.archivedAt) throw new ApiError(400, "This community is archived.");
  return NextResponse.json({ joined: true, memberCount: await join(actor.id, c.id) });
});

export const DELETE = route<Ctx>("communities.leave", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("follow", actor.id, RATE_LIMITS.follow);
  const c = await find((await params).slug);
  return NextResponse.json({ joined: false, memberCount: await leave(actor.id, c.id) });
});
