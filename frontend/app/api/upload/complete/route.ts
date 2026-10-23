import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, requireUserId, route } from "@/lib/api";
import { createSongRecord, MAX_SONG_BYTES } from "@/lib/songs";
import { getStorage, isValidKey, sniffAudio } from "@/lib/storage";

/** Body: { key, name, durationSec? }. Verifies a direct upload's owner, size and bytes, then creates the song. */
export const POST = route("upload.complete", async (req) => {
  const userId = await requireUserId("Sign in to upload a song.", { write: true });
  const { key, name, durationSec } = await readJson(req);
  // Keys carry the uploader's id, so nobody can claim someone else's object.
  if (typeof key !== "string" || !isValidKey(key) || !key.startsWith(`${userId}/`) || key.startsWith("media/")) throw new ApiError(404, "Upload not found.");
  // Completing twice returns the same song rather than a second job for one file.
  const existing = await prisma.song.findFirst({ where: { userId, storageKey: key }, select: { id: true, title: true, artist: true, status: true, createdAt: true } });
  if (existing) return NextResponse.json({ song: existing, analysisJobId: existing.id }, { status: 200 });
  const storage = getStorage();
  const stat = await storage.stat(key);
  if (!stat) throw new ApiError(409, "The upload hasn't finished yet.");
  const reject = async (status: number, message: string) => {
    await storage.remove(key);
    throw new ApiError(status, message);
  };
  if (stat.size > MAX_SONG_BYTES) await reject(413, "File is too large (50MB max).");
  const obj = await storage.get(key);
  if (!obj) throw new ApiError(409, "The upload hasn't finished yet.");
  const ext = sniffAudio(obj.bytes.subarray(0, 64));
  if (!ext || !key.endsWith(`.${ext}`)) await reject(400, "Unsupported file type. Upload MP3, WAV, or FLAC.");
  const song = await createSongRecord(userId, key, typeof name === "string" ? name : "Untitled upload", typeof durationSec === "number" ? durationSec : null);
  return NextResponse.json({ song, analysisJobId: song.id }, { status: 201 });
});
