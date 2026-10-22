import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { getActor } from "@/lib/authz";
import { getPublicProfile } from "@/lib/profiles";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ handle: string }> };

export const GET = route<Ctx>("users.get", async (req, { params }) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const actor = await getActor();
  const profile = await getPublicProfile((await params).handle, actor?.id ?? null);
  if (!profile) throw new ApiError(404, "Musician not found.");
  return NextResponse.json({ profile });
});
