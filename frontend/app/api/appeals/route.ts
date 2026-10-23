import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { fileAppeal, parseAppeal } from "@/lib/reports";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const GET = route("appeals.list", async () => {
  const actor = await requireActor();
  const items = await prisma.appeal.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, targetType: true, targetId: true, body: true, status: true, decisionNote: true, decidedAt: true, createdAt: true },
  });
  return NextResponse.json({ items });
});

export const POST = route("appeals.create", async (req) => {
  const actor = await requireActor();
  await enforceRateLimit("report", actor.id, RATE_LIMITS.report);
  const appeal = await fileAppeal(actor, parseAppeal(await readJson(req)));
  return NextResponse.json({ appeal }, { status: 201 });
});
