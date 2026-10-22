import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/queue";
import { isValidKey } from "@/lib/storage";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";

/**
 * Deletes a user and everything they own. Database rows go in one
 * transaction (cascades remove tones, songs, media, posts, follows, sessions); stored files
 * are removed afterwards by storage.delete jobs queued in that same
 * transaction, so files are only deleted if the rows really are.
 */
export async function deleteAccount(userId: string): Promise<{ queuedDeletes: number }> {
  return prisma.$transaction(async (tx) => {
    const admins = await tx.$queryRaw<{ id: string; status: string }[]>`SELECT id, status FROM "User" WHERE role = 'ADMIN' ORDER BY id FOR UPDATE`;
    if (admins.some((a) => a.id === userId && a.status === "ACTIVE") && admins.filter((a) => a.status === "ACTIVE").length <= 1) {
      throw new ApiError(409, "Appoint another active admin before deleting your account.");
    }
    const songs = await tx.song.findMany({ where: { userId, storageKey: { not: null } }, select: { storageKey: true } });
    const media = await tx.media.findMany({ where: { ownerId: userId }, select: { originalKey: true, playbackKey: true, posterKey: true, previewKey: true, peaksKey: true } });
    const keys = [
      ...songs.map((s) => s.storageKey!),
      ...media.flatMap((m) => [m.originalKey, m.playbackKey, m.posterKey, m.previewKey, m.peaksKey]),
    ].filter((k): k is string => !!k && isValidKey(k));
    for (const key of keys) await enqueue("storage.delete", { key }, { db: tx });

    // Keep everyone else's follow counters exact before the edges cascade away.
    await tx.user.updateMany({ where: { followers: { some: { followerId: userId } } }, data: { followerCount: { decrement: 1 } } });
    await tx.user.updateMany({ where: { following: { some: { followingId: userId } } }, data: { followingCount: { decrement: 1 } } });

    await tx.community.updateMany({ where: { members: { some: { userId } } }, data: { memberCount: { decrement: 1 } } });
    await tx.tone.updateMany({ where: { saves: { some: { userId } } }, data: { saveCount: { decrement: 1 } } });
    await tx.post.updateMany({ where: { bookmarks: { some: { userId } } }, data: { bookmarkCount: { decrement: 1 } } });
    await tx.$executeRaw`
      UPDATE "Post" p SET score = p.score - v.value,
        "upCount" = p."upCount" - CASE WHEN v.value = 1 THEN 1 ELSE 0 END,
        "hotRank" = round((sign(p.score - v.value) * log(greatest(abs(p.score - v.value), 1))
          + (extract(epoch FROM p."createdAt") - 1767225600) / 45000)::numeric, 7)
      FROM "PostVote" v WHERE v."postId" = p.id AND v."userId" = ${userId}`;
    await tx.$executeRaw`
      UPDATE "Comment" c SET score = c.score - v.value
      FROM "CommentVote" v WHERE v."commentId" = c.id AND v."userId" = ${userId}`;
    await tx.$executeRaw`
      UPDATE "User" u SET reputation = u.reputation - contributions.total FROM (
        SELECT "authorId", sum(value)::int total FROM (
          SELECT p."authorId", v.value FROM "PostVote" v JOIN "Post" p ON p.id = v."postId" WHERE v."userId" = ${userId} AND p."authorId" <> ${userId}
          UNION ALL
          SELECT c."authorId", v.value FROM "CommentVote" v JOIN "Comment" c ON c.id = v."commentId" WHERE v."userId" = ${userId} AND c."authorId" <> ${userId}
        ) votes GROUP BY "authorId"
      ) contributions WHERE u.id = contributions."authorId"`;
    await tx.$executeRaw`
      UPDATE "Tone" t SET "remixCount" = t."remixCount" - r.n FROM
      (SELECT "remixOfId", count(*)::int n FROM "Tone" WHERE "userId" = ${userId} GROUP BY "remixOfId") r
      WHERE t.id = r."remixOfId"`;
    await tx.$executeRaw`
      UPDATE "Community" c SET "postCount" = c."postCount" - p.n FROM
      (SELECT "communityId", count(*)::int n FROM "Post" WHERE "authorId" = ${userId} AND status <> 'DELETED' GROUP BY "communityId") p
      WHERE c.id = p."communityId"`;

    // The comment FK cascades through replies; detach other people's replies before deleting this author.
    const affected = await tx.comment.findMany({ where: { authorId: userId }, select: { postId: true, parentId: true } });
    await tx.$executeRaw`
      WITH RECURSIVE survivors AS (
        SELECT c.id, 0 depth FROM "Comment" c JOIN "Comment" parent ON parent.id = c."parentId"
        WHERE parent."authorId" = ${userId} AND c."authorId" <> ${userId}
        UNION ALL
        SELECT c.id, s.depth + 1 FROM "Comment" c JOIN survivors s ON c."parentId" = s.id WHERE c."authorId" <> ${userId}
      ) UPDATE "Comment" c SET depth = s.depth FROM survivors s WHERE c.id = s.id`;
    await tx.comment.updateMany({ where: { authorId: { not: userId }, parent: { authorId: userId } }, data: { parentId: null } });
    await tx.verificationToken.deleteMany({ where: { identifier: { in: [`verify:${userId}`, `reset:${userId}`] } } });

    await tx.user.delete({ where: { id: userId } });
    const postIds = [...new Set(affected.map((c) => c.postId))];
    const parentIds = [...new Set(affected.flatMap((c) => c.parentId ? [c.parentId] : []))];
    if (postIds.length) await tx.$executeRaw`
      UPDATE "Post" p SET "commentCount" = (SELECT count(*)::int FROM "Comment" c WHERE c."postId" = p.id AND c.status = 'PUBLISHED')
      WHERE p.id IN (${Prisma.join(postIds)})`;
    if (parentIds.length) await tx.$executeRaw`
      UPDATE "Comment" p SET "replyCount" = (SELECT count(*)::int FROM "Comment" c WHERE c."parentId" = p.id AND c.status = 'PUBLISHED')
      WHERE p.id IN (${Prisma.join(parentIds)})`;
    return { queuedDeletes: keys.length };
  });
}
