import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { isStaff } from "@/lib/permissions";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseStatusChange, setUserRole, setUserStatus } from "@/lib/admin/users";
import type { Role } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/** { action: "status", status, days?, reason } | { action: "role", role } — permission checks live in lib/admin/users. */
export const POST = route<Ctx>("admin.users.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  if (!isStaff(actor.role)) throw new ApiError(403, "Not allowed.");
  enforceRateLimit("moderation", actor.id, RATE_LIMITS.moderation);
  const { id } = await params;
  const body = await readJson(req);
  if (body.action === "status") await setUserStatus(actor, id, parseStatusChange(body));
  else if (body.action === "role") await setUserRole(actor, id, body.role as Role);
  else throw new ApiError(400, "Unknown action.");
  return NextResponse.json({ ok: true });
});
