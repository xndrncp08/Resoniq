import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, requireUserId, route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { CONTENT_TYPES, getStorage, sniffAudio } from "@/lib/storage";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const MULTIPART_OVERHEAD = 64 * 1024;
const MAX_TITLE_LENGTH = 200;

export const POST = route("upload", async (req) => {
  const userId = await requireUserId("Sign in to upload a song.");
  enforceRateLimit("upload", userId, RATE_LIMITS.upload);

  // Refuse oversized bodies before buffering them.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES + MULTIPART_OVERHEAD) {
    throw new ApiError(413, "File is too large (50MB max).");
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw new ApiError(400, "Expected a multipart form upload.");
  }
  const file = formData.get("file");
  const durationSec = Number(formData.get("durationSec"));

  if (!(file instanceof File)) throw new ApiError(400, "No file provided.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "File is too large (50MB max).");

  // The file's bytes decide the type, not its name or the browser-reported
  // MIME type (which is inconsistent for audio and trivially spoofed).
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniffAudio(bytes);
  if (!ext) throw new ApiError(400, "Unsupported file type. Upload MP3, WAV, or FLAC.");

  const storage = getStorage();
  const storageKey = `${userId}/${crypto.randomUUID()}.${ext}`;
  await storage.put(storageKey, bytes, CONTENT_TYPES[ext]);

  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").slice(0, MAX_TITLE_LENGTH);
  const [maybeArtist, maybeTitle] = nameWithoutExt.split(/\s*-\s*/, 2);

  let song;
  try {
    song = await prisma.song.create({
      data: {
        userId,
        title: maybeTitle || nameWithoutExt || "Untitled upload",
        artist: maybeTitle ? maybeArtist : null,
        storageKey,
        durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : null,
        sourceType: "UPLOAD",
        status: "UPLOADED",
      },
      select: { id: true, title: true, artist: true, status: true, createdAt: true },
    });
  } catch (err) {
    // Don't leave an orphaned file behind if the row can't be written.
    await storage.remove(storageKey).catch((cleanupErr) => console.error("[api] upload cleanup failed", cleanupErr));
    throw err;
  }

  // The Song row doubles as the analysis job: its status moves
  // UPLOADED -> ANALYZING -> ANALYZED | FAILED via POST /api/analyze.
  return NextResponse.json({ song, analysisJobId: song.id }, { status: 201 });
});
