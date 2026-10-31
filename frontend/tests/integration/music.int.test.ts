import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/authz";
import { createPost, listPosts } from "@/lib/posts";
import { artistsToDiscover, forYouWhere, genreWhere, musicGenres, MUSIC_WHERE, notifyFollowersOfRelease } from "@/lib/music";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

const release = (a: Actor, title: string, body = "") => createPost(a, { title, body, category: "ORIGINAL", communitySlug: null, toneId: null });
const ids = async (where: object, viewer: string | null = null) => (await listPosts(where, viewer, { sort: "new", cursor: null, limit: 20 })).items.map((p) => p.title);

describe("music discovery", () => {
  it("browses original music by the artist's genre or the release's tag, and suggests artists", async () => {
    const me = await makeActor();
    const jazz = await makeActor();
    const metal = await makeActor();
    const followed = await makeActor();
    await prisma.user.update({ where: { id: me.id }, data: { genres: ["jazz"] } });
    await prisma.user.update({ where: { id: jazz.id }, data: { genres: ["jazz", "soul"] } });
    await prisma.user.update({ where: { id: metal.id }, data: { genres: ["metal"] } });
    await release(jazz, "Blue Hour");
    await release(metal, "Iron Tide", "#doom riff");
    await release(followed, "Followed One");
    await release(me, "My Own");
    await createPost(jazz, { title: "Not music", body: "A question", category: "QUESTION", communitySlug: null, toneId: null });
    await prisma.follow.create({ data: { followerId: me.id, followingId: followed.id } });

    expect((await ids(MUSIC_WHERE)).sort()).toEqual(["Blue Hour", "Followed One", "Iron Tide", "My Own"]);
    expect((await ids({ AND: [MUSIC_WHERE, genreWhere("Jazz")] })).sort()).toEqual(["Blue Hour", "My Own"]);
    expect(await ids({ AND: [MUSIC_WHERE, genreWhere("doom")] })).toEqual(["Iron Tide"]);
    // For you: people I follow, and artists who share my genres; never my own.
    expect((await ids({ AND: [MUSIC_WHERE, await forYouWhere(me.id)] })).sort()).toEqual(["Blue Hour", "Followed One"]);

    const artists = await artistsToDiscover(me.id);
    expect(artists.map((a) => a.id)).not.toContain(me.id);
    expect(artists.map((a) => a.id)).not.toContain(followed.id);
    expect(artists[0]).toMatchObject({ id: jazz.id, sharedGenres: ["jazz"], releases: 1 });
    expect(await musicGenres()).toEqual(expect.arrayContaining(["jazz", "soul", "metal", "doom"]));
  });

  it("tells followers about a new release, but not credited people twice or about community posts", async () => {
    const artist = await makeActor();
    const fan = await makeActor();
    const bandmate = await makeActor();
    for (const f of [fan, bandmate]) await prisma.follow.create({ data: { followerId: f.id, followingId: artist.id } });
    const post = { id: (await release(artist, "Debut")).id, authorId: artist.id, category: "ORIGINAL", community: null };
    await notifyFollowersOfRelease(post, [bandmate.id]);
    await notifyFollowersOfRelease({ ...post, community: { slug: "jazz" } });
    await notifyFollowersOfRelease({ ...post, category: "QUESTION" });
    const sent = await prisma.notification.findMany({ where: { type: "NEW_RELEASE" }, select: { userId: true, actorId: true, postId: true } });
    expect(sent).toEqual([{ userId: fan.id, actorId: artist.id, postId: post.id }]);
  });
});
