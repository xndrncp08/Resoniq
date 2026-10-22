import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";

/** Body: { ids: string[] } or { all: true }. */
export const POST = route("notifications.read", async (req) => {
  const actor = await requireActor();
  const { ids, all } = await readJson(req);
  const only = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string").slice(0, 200) : null;
  if (!all && !only?.length) return NextResponse.json({ updated: 0 });
  const { count } = await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...(!all && { id: { in: only! } }) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ updated: count });
});
