import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/queue";

/**
 * Deletes a user and everything they own. Database rows go in one
 * transaction (cascades remove tones, songs, follows, sessions); stored audio
 * is removed afterwards by storage.delete jobs queued in that same
 * transaction, so files are only deleted if the rows really are.
 */
export async function deleteAccount(userId: string): Promise<{ queuedDeletes: number }> {
  return prisma.$transaction(async (tx) => {
    const songs = await tx.song.findMany({ where: { userId, storageKey: { not: null } }, select: { storageKey: true } });
    for (const { storageKey } of songs) await enqueue("storage.delete", { key: storageKey! }, { db: tx });

    // Keep everyone else's follow counters exact before the edges cascade away.
    await tx.user.updateMany({ where: { followers: { some: { followerId: userId } } }, data: { followerCount: { decrement: 1 } } });
    await tx.user.updateMany({ where: { following: { some: { followingId: userId } } }, data: { followingCount: { decrement: 1 } } });

    await tx.user.delete({ where: { id: userId } });
    return { queuedDeletes: songs.length };
  });
}
