import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { parseRange } from "@/lib/http-range";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { audibleTake } from "@/lib/riffs/service";
import { getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** A take's audio for its owner or the riff's project members. Supabase: a 5-minute signed URL; local: ranged stream. */
export const GET = route<Ctx>("riff-takes.audio", async (req, { params }) => {
  const actor = await requireActor();
  await enforceRateLimit("media-read", actor.id, RATE_LIMITS.mediaRead);
  const take = await audibleTake(actor.id, (await params).id);
  if (!take) throw new ApiError(404, "Not found.");
  const cache = "private, no-store";
  const storage = getStorage();
  if (storage.driver === "supabase") return NextResponse.redirect(await storage.signedUrl(take.storageKey, 300), { status: 302, headers: { "Cache-Control": cache } });
  const stat = await storage.stat(take.storageKey);
  if (!stat) throw new ApiError(404, "Not found.");
  const headers: Record<string, string> = { "Content-Type": take.mime, "Accept-Ranges": "bytes", "Cache-Control": cache, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" };
  const range = parseRange(req.headers.get("range"), stat.size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${stat.size}` } });
  if (range) return new Response(storage.readStream(take.storageKey, range), { status: 206, headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`, "Content-Length": String(range.end - range.start + 1) } });
  return new Response(storage.readStream(take.storageKey), { headers: { ...headers, "Content-Length": String(stat.size) } });
});
