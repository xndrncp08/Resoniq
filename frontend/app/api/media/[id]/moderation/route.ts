import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { removeMedia, restoreMedia } from "@/lib/media/service";
import { parseModeration } from "@/lib/moderation";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { action: "remove" | "restore", reason }. Copyright takedowns use this with the report's reason. */
export const POST = route<Ctx>("media.moderate", async (req, { params }) => {
  const actor = await requirePermission("content.moderate");
  await enforceRateLimit("moderation", actor.id, RATE_LIMITS.moderation);
  const { id } = await params;
  const { action, reason } = parseModeration(await readJson(req));
  if (action === "remove") await removeMedia(actor, id, reason, { asModerator: true });
  else await restoreMedia(actor, id);
  return NextResponse.json({ ok: true });
});
