import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, requireUserId, route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { MAX_SONG_BYTES } from "@/lib/songs";
import { getStorage } from "@/lib/storage";

/**
 * Remote storage only: reserves a key and returns a signed URL the browser
 * uploads to directly (serverless functions cap request bodies at a few MB).
 * Body: { size, name }. The bytes are checked in /api/upload/complete.
 */
export const POST = route("upload.direct", async (req) => {
  const userId = await requireUserId("Sign in to upload a song.", { write: true });
  await enforceRateLimit("upload", userId, RATE_LIMITS.upload);
  const storage = getStorage();
  if (storage.driver !== "supabase") throw new ApiError(404, "Upload through /api/upload.");
  const { size, name } = await readJson(req);
  if (!Number.isInteger(size) || (size as number) <= 0) throw new ApiError(400, "size must be the file's byte count.");
  if ((size as number) > MAX_SONG_BYTES) throw new ApiError(413, "File is too large (50MB max).");
  // Provisional extension from the name; completion re-derives it from the bytes and refuses mismatches.
  const ext = String(name ?? "").toLowerCase().match(/\.(mp3|wav|flac)$/)?.[1];
  if (!ext) throw new ApiError(400, "Unsupported file type. Upload MP3, WAV, or FLAC.");
  const key = `${userId}/${crypto.randomUUID()}.${ext}`;
  return NextResponse.json({ key, url: await storage.createUploadUrl(key) }, { status: 201 });
});
