import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/queue";
import { isValidKey } from "@/lib/storage";

/**
 * Deletes a user and everything they own. Database rows go in one
 * transaction (cascades remove tones, songs, media, posts, follows, sessions); stored files
 * are removed afterwards by storage.delete jobs queued in that same
 * transaction, so files are only deleted if the rows really are.
 */
export async function deleteAccount(userId: string): Promise<{ queuedDeletes: number }> {
  return prisma.$transaction(async (tx) => {
    const songs = await tx.song.findMany({ where: { userId, storageKey: { not: null } }, select: { storageKey: true } });
    const media = await tx.media.findMany({ where: { ownerId: userId }, select: { originalKey: true, playbackKey: true, posterKey: true, previewKey: true, peaksKey: true, status: true } });
    const keys = [
      ...songs.map((s) => s.storageKey!),
      ...media.flatMap((m) => [m.status === "UPLOADING" || m.status === "PROCESSING" ? m.originalKey : null, m.playbackKey, m.posterKey, m.previewKey, m.peaksKey]),
    ].filter((k): k is string => !!k && isValidKey(k));
    for (const key of keys) await enqueue("storage.delete", { key }, { db: tx });

    // Keep everyone else's follow counters exact before the edges cascade away.
    await tx.user.updateMany({ where: { followers: { some: { followerId: userId } } }, data: { followerCount: { decrement: 1 } } });
    await tx.user.updateMany({ where: { following: { some: { followingId: userId } } }, data: { followingCount: { decrement: 1 } } });

    await tx.user.delete({ where: { id: userId } });
    return { queuedDeletes: keys.length };
  });
}
