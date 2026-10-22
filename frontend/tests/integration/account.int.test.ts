import { beforeEach, expect, it } from "vitest";
import { deleteAccount } from "@/lib/account";
import { createComment, voteComment } from "@/lib/comments";
import { createPost, setBookmark, votePost } from "@/lib/posts";
import { hotRank } from "@/lib/ranking";
import { makeActor, prisma, resetDb } from "./db";
beforeEach(resetDb);

it("keeps the last active administrator until another administrator takes over", async () => {
  const only = await makeActor();
  await prisma.user.update({ where: { id: only.id }, data: { role: "ADMIN" } });
  await expect(deleteAccount(only.id)).rejects.toThrow("Appoint another active admin");
  const next = await makeActor();
  await prisma.user.update({ where: { id: next.id }, data: { role: "ADMIN" } });
  await expect(deleteAccount(only.id)).resolves.toEqual({ queuedDeletes: 0 });
});

it("preserves other members' replies and repairs community and tone counters on deletion", async () => {
  const gone = await makeActor();
  const keeper = await makeActor();
  const community = await prisma.community.create({ data: { slug: "studio", name: "Studio", memberCount: 1, postCount: 1, members: { create: { userId: gone.id } } } });
  const p = await createPost(keeper, { title: null, body: "A session", category: "DISCUSSION", communitySlug: null, toneId: null });
  const root = await createComment(gone, p.id, { body: "Leaving", parentId: null });
  const reply = await createComment(keeper, p.id, { body: "Keep my reply", parentId: root.id });
  const child = await createComment(keeper, p.id, { body: "And this one", parentId: reply.id });
  await votePost(gone.id, p.id, 1);
  await voteComment(gone.id, reply.id, 1);
  await setBookmark(gone.id, p.id, true);
  await prisma.post.create({ data: { authorId: gone.id, communityId: community.id, body: "My post" } });
  const tone = await prisma.tone.create({ data: { userId: keeper.id, name: "Kept", saveCount: 1, remixCount: 1, saves: { create: { userId: gone.id } } } });
  await prisma.tone.create({ data: { userId: gone.id, name: "Remix", remixOfId: tone.id } });
  await prisma.verificationToken.create({ data: { identifier: `reset:${gone.id}`, token: "hashed", expires: new Date(Date.now() + 10000) } });
  await deleteAccount(gone.id);
  expect(await prisma.comment.findUniqueOrThrow({ where: { id: reply.id } })).toMatchObject({ body: "Keep my reply", parentId: null, depth: 0 });
  expect(await prisma.comment.findUniqueOrThrow({ where: { id: child.id } })).toMatchObject({ parentId: reply.id, depth: 1 });
  const keptPost = await prisma.post.findUniqueOrThrow({ where: { id: p.id } });
  expect(keptPost).toMatchObject({ commentCount: 2, score: 0, upCount: 0, bookmarkCount: 0, hotRank: hotRank(0, keptPost.createdAt) });
  expect((await prisma.comment.findUniqueOrThrow({ where: { id: reply.id } })).score).toBe(0);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: keeper.id } })).reputation).toBe(0);
  expect(await prisma.community.findUniqueOrThrow({ where: { id: community.id } })).toMatchObject({ memberCount: 0, postCount: 0 });
  expect(await prisma.tone.findUniqueOrThrow({ where: { id: tone.id } })).toMatchObject({ saveCount: 0, remixCount: 0 });
  expect(await prisma.verificationToken.count()).toBe(0);
});
