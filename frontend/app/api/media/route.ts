import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { createUpload, parseUploadRequest } from "@/lib/media/service";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Starts an upload. Body: { kind, size, mime?, purpose?, alt? }.
 * Returns where to PUT the bytes (this app, or a signed storage URL), then
 * the client calls POST /api/media/[id]/complete.
 */
export const POST = route("media.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("media-upload", actor.id, RATE_LIMITS.mediaUpload);
  return NextResponse.json(await createUpload(actor, parseUploadRequest(await readJson(req))), { status: 201 });
});
