import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { LayoutError, parseWorkspaceLayout } from "@/lib/studio/layout-validation";

/** The signed-in user's saved Studio layout, or null if they haven't got one yet. */
export const GET = route("workspace.get", async () => {
  const userId = await requireUserId();
  enforceRateLimit("workspace-read", userId, RATE_LIMITS.toneRead);
  const row = await prisma.userWorkspace.findUnique({ where: { userId }, select: { layout: true, updatedAt: true } });
  return NextResponse.json({ layout: row?.layout ?? null, updatedAt: row?.updatedAt ?? null });
});

/** Saves the layout. The row is keyed by the session's user id, so there's nothing else to own-check. */
export const PUT = route("workspace.put", async (req) => {
  const userId = await requireUserId();
  enforceRateLimit("workspace-write", userId, RATE_LIMITS.workspaceWrite);

  const body = await readJson(req, 64 * 1024);
  let layout;
  try {
    layout = parseWorkspaceLayout(body.layout);
  } catch (err) {
    if (err instanceof LayoutError) throw new ApiError(400, err.message);
    throw err;
  }

  // A validated WorkspaceLayout is plain JSON; Prisma's input type can't see that.
  const json = layout as unknown as Prisma.InputJsonValue;
  const row = await prisma.userWorkspace.upsert({
    where: { userId },
    create: { userId, layout: json },
    update: { layout: json },
    select: { updatedAt: true },
  });
  return NextResponse.json({ ok: true, updatedAt: row.updatedAt });
});
