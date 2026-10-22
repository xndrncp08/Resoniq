import { beforeEach, describe, expect, it } from "vitest";
import { platformCounts, risingMusicians, suggestedCommunities, trendingTags } from "@/lib/discovery";
import { createPost, votePost } from "@/lib/posts";
import { searchAll, searchCommunities, searchGearItems, searchMusicians, searchPosts, searchTones } from "@/lib/search";
import { createTone } from "@/lib/tones";
import { seed } from "@/prisma/seed";
import { makeActor, prisma, resetDb } from "./db";

const base = { title: null, category: "DISCUSSION" as const, communitySlug: null, toneId: null };

beforeEach(async () => {
  await resetDb();
  await seed(prisma);
});

describe("discovery", () => {
  it("computes trending tags, rising musicians and suggestions from real rows only", async () => {
    const a = await makeActor({ handle: "mia_strat" });
    const fan = await makeActor();
    const p = await createPost(a, { ...base, body: "Edge of breakup #blues #tweed" });
    await createPost(a, { ...base, body: "More #blues" });
    await votePost(fan.id, p.id, 1);
    expect(await trendingTags()).toEqual([{ tag: "blues", uses: 2 }, { tag: "tweed", uses: 1 }]);
    expect((await risingMusicians(fan.id)).map((m) => m.handle)).toEqual(["mia_strat"]);
    expect(await risingMusicians(a.id)).toEqual([]);
    await prisma.user.update({ where: { id: fan.id }, data: { genres: ["metal"] } });
    expect((await suggestedCommunities(fan.id, 3))[0].slug).toBe("metal");
    expect((await platformCounts()).posts).toBe(2);
  });
});

describe("search", () => {
  it("finds posts, tones, communities, musicians and gear, and hides what shouldn't show", async () => {
    const a = await makeActor({ handle: "riff_queen", name: "Riff Queen" });
    const banned = await makeActor({ handle: "riff_banned" });
    await createPost(a, { ...base, title: "Plexi crunch secrets", body: "Variac and a treble booster" });
    await createPost(banned, { ...base, body: "plexi from a banned account" });
    await prisma.user.update({ where: { id: banned.id }, data: { status: "BANNED" } });
    await createTone(a, { name: "Plexi at noon", rig: { chain: [] , notes: "x" }, visibility: "PUBLIC" });
    await createTone(a, { name: "Plexi secret", rig: { chain: [], notes: "x" }, visibility: "PRIVATE" });

    expect((await searchPosts("plexi", null)).map((p) => p.title)).toEqual(["Plexi crunch secrets"]);
    expect((await searchTones("plexi", null)).map((t) => t.name)).toEqual(["Plexi at noon"]);
    expect((await searchCommunities("blues")).map((c) => c.slug)).toContain("blues");
    expect((await searchMusicians("riff")).map((u) => u.handle)).toEqual(["riff_queen"]);
    expect((await searchMusicians("@Riff_Quen")).map((u) => u.handle)).toContain("riff_queen");
    expect((await searchGearItems("tube screamr"))[0]?.model).toMatch(/Tube Screamer/);
    const all = await searchAll('"crunch secrets"', null);
    expect(all.posts).toHaveLength(1);
  });
});
