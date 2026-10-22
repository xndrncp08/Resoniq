import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { GEAR_SELECT } from "@/lib/gear";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { listTones } from "@/lib/tones";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route<Ctx>("gear.get", async (req, { params }) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const item = await prisma.gearItem.findFirst({ where: { slug: (await params).slug, status: "APPROVED" }, select: GEAR_SELECT });
  if (!item) throw new ApiError(404, "Gear not found.");
  const viewer = await optionalActor();
  const p = new URL(req.url).searchParams;
  const tones = await listTones(viewer?.id ?? null, { sort: p.get("sort") === "new" ? "new" : "popular", gearId: item.id, cursor: decodeCursor(p.get("cursor")), limit: parseLimit(p.get("limit")) });
  return NextResponse.json({ item, tones });
});
