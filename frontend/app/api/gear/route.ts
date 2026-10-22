import { NextResponse } from "next/server";
import type { GearKind } from "@prisma/client";
import { enforceRateLimit, optionalActor, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { GEAR_KINDS, parseGearSubmission, popularGear, searchGear, submitGear } from "@/lib/gear";
import { parseLimit } from "@/lib/pagination";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

/** ?q= search, or ?popular=1 for the most-used gear across public tones. Optional &kind=. */
export const GET = route("gear.search", async (req) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const p = new URL(req.url).searchParams;
  const kind = GEAR_KINDS.includes(p.get("kind") as GearKind) ? (p.get("kind") as GearKind) : null;
  const limit = parseLimit(p.get("limit"), 20, 50);
  if (p.get("popular") === "1") return NextResponse.json({ items: await popularGear(kind, limit) });
  const viewer = await optionalActor();
  return NextResponse.json({ items: await searchGear(p.get("q")?.slice(0, 80) ?? "", kind, limit, viewer?.id ?? null) });
});

export const POST = route("gear.submit", async (req) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("report", actor.id, RATE_LIMITS.report);
  return NextResponse.json({ item: await submitGear(actor, parseGearSubmission(await readJson(req))) }, { status: 201 });
});
