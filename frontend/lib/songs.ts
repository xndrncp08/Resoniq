import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

const MAX_TITLE_LENGTH = 200;
export const MAX_SONG_BYTES = 50 * 1024 * 1024;

/** The Song row doubles as the analysis job (UPLOADED → ANALYZING → ANALYZED | FAILED). Removes the file if the row can't be written. */
export async function createSongRecord(userId: string, storageKey: string, fileName: string, durationSec: number | null) {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").slice(0, MAX_TITLE_LENGTH);
  const [maybeArtist, maybeTitle] = nameWithoutExt.split(/\s*-\s*/, 2);
  try {
    return await prisma.song.create({
      data: {
        userId,
        title: maybeTitle || nameWithoutExt || "Untitled upload",
        artist: maybeTitle ? maybeArtist : null,
        storageKey,
        durationSec: durationSec && Number.isFinite(durationSec) && durationSec > 0 ? durationSec : null,
        sourceType: "UPLOAD",
        status: "UPLOADED",
      },
      select: { id: true, title: true, artist: true, status: true, createdAt: true },
    });
  } catch (err) {
    await getStorage().remove(storageKey).catch((cleanupErr) => console.error("[api] upload cleanup failed", cleanupErr));
    throw err;
  }
}
