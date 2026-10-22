import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { parseRange } from "@/lib/http-range";
import { canViewMedia, keyFor, type MediaVariant } from "@/lib/media/service";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { contentTypeFor, getStorage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; variant: string }> };
const VARIANTS: MediaVariant[] = ["playback", "poster", "preview", "peaks"];

/**
 * Serves a processed media file to whoever may see it. Local storage streams
 * with byte ranges (video seeking); Supabase redirects to a 5-minute signed URL.
 */
export const GET = route<Ctx>("media.serve", async (req, { params }) => {
  enforceRateLimit("media-read", clientIp(req), RATE_LIMITS.mediaRead);
  const { id, variant } = await params;
  if (!VARIANTS.includes(variant as MediaVariant)) throw new ApiError(404, "Not found.");
  const media = await prisma.media.findUnique({ where: { id } });
  const viewer = await optionalActor();
  const key = media && keyFor(media, variant as MediaVariant);
  if (!media || !key || media.status === "REMOVED" || !(await canViewMedia(media, viewer))) throw new ApiError(404, "Not found.");

  // Derivatives never change for a given id, but access can: cache privately and briefly.
  const cache = media.status === "READY" ? "private, max-age=300" : "private, no-store";
  const storage = getStorage();
  if (storage.driver === "supabase") {
    return NextResponse.redirect(await storage.signedUrl(key, 300), { status: 302, headers: { "Cache-Control": "private, max-age=240" } });
  }
  const stat = await storage.stat(key);
  if (!stat) throw new ApiError(404, "Not found.");
  const headers: Record<string, string> = { "Content-Type": contentTypeFor(key), "Accept-Ranges": "bytes", "Cache-Control": cache, "Content-Disposition": "inline" };
  const range = parseRange(req.headers.get("range"), stat.size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${stat.size}` } });
  if (range) {
    return new Response(storage.readStream(key, range), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`, "Content-Length": String(range.end - range.start + 1) },
    });
  }
  return new Response(storage.readStream(key), { headers: { ...headers, "Content-Length": String(stat.size) } });
});
