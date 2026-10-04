import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireUserId, route } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { parseRange } from "@/lib/http-range";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Streams the owner's uploaded audio (for the dashboard's signal monitor).
 * Only the uploader can fetch it; the public /t/[id] page never links here.
 */
export const GET = route<Ctx>("songs.audio", async (req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;

  const song = await prisma.song.findFirst({ where: { id, userId }, select: { storageKey: true, fileUrl: true } });
  if (!song) throw new ApiError(404, "Song not found.");
  if (!song.storageKey) {
    // Uploads from before private storage still live at their public URL.
    if (song.fileUrl) return NextResponse.redirect(song.fileUrl);
    throw new ApiError(404, "Song not found.");
  }

  const stored = await getStorage().get(song.storageKey);
  if (!stored) throw new ApiError(404, "Audio not found.");

  const size = stored.bytes.length;
  const headers: Record<string, string> = {
    "Content-Type": stored.contentType,
    "Accept-Ranges": "bytes",
    // Not cached: a cached copy would stay playable in this browser after sign-out.
    "Cache-Control": "private, no-store",
  };

  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  if (range) {
    const chunk = stored.bytes.subarray(range.start, range.end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(chunk.length),
      },
    });
  }
  return new Response(new Uint8Array(stored.bytes), { headers: { ...headers, "Content-Length": String(size) } });
});
