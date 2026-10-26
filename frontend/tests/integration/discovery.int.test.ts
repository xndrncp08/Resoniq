import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverMusicians, platformCounts, risingMusicians, suggestedCommunities, trendingTags } from "@/lib/discovery";
import { parseMusicianFilters } from "@/lib/musician-directory";
import { ensureManagedCreators } from "@/lib/managed-creators";
import { createPost, votePost } from "@/lib/posts";
import { searchAll, searchCommunities, searchGearItems, searchMusicians, searchPosts, searchTones } from "@/lib/search";
import { createTone } from "@/lib/tones";
import { seed } from "@/prisma/seed";
import { makeActor, prisma, resetDb } from "./db";

// Each case replaces the database contents; cache behavior has its own unit tests.
vi.mock("@/lib/memo", () => ({ memo: (_key: string, _ttl: number, load: () => Promise<unknown>) => load() }));

const base = { title: null, category: "DISCUSSION" as const, communitySlug: null, toneId: null };

beforeEach(async () => {
  await resetDb();
  await seed(prisma);
});

describe("discovery", () => {
  it("finds members by their instruments, genre and bio without requiring posts or votes", async () => {
    const a = await makeActor({ handle: "mia_sax", name: "Mia Santos" });
    await prisma.user.update({ where: { id: a.id }, data: { instruments: ["woodwinds", "keys"], genres: ["jazz"], bio: "Learning kundiman arrangements" } });
    await makeActor({ handle: "mia_bass" });
    for (const q of ["MIA", "santos", "KUNDIMAN", "@mia_sax"]) {
      const found = await discoverMusicians(parseMusicianFilters({ q, instrument: "woodwinds", genre: "Jazz" }));
      expect(found.items.map((u) => u.handle)).toEqual(["mia_sax"]);
      expect(Object.keys(found.items[0]).sort()).toEqual(["bio", "genres", "handle", "id", "image", "instruments", "location", "name", "openTo"]);
    }
    expect((await discoverMusicians(parseMusicianFilters({ instrument: "bass", genre: "jazz" }))).items).toEqual([]);
    expect((await discoverMusicians(parseMusicianFilters({ instrument: "woodwinds", genre: "jaz" }))).items).toEqual([]);
    await prisma.user.update({ where: { id: a.id }, data: { instruments: ["bass"] } });
    expect((await discoverMusicians(parseMusicianFilters({ instrument: "bass", genre: "jazz" }))).items.map((u) => u.handle)).toEqual(["mia_sax"]);
  });

  it("excludes banned, suspended, system and managed identities", async () => {
    await ensureManagedCreators(prisma);
    const demo = await prisma.user.findUniqueOrThrow({ where: { handle: "resoniq_clara" } });
    await prisma.post.create({ data: { authorId: demo.id, body: "An editorial demo", category: "DISCUSSION", status: "PUBLISHED", upCount: 5 } });
    await prisma.user.createMany({ data: [
      { handle: "human_player" }, { handle: "hidden_banned", status: "BANNED" },
      { handle: "hidden_suspended", status: "SUSPENDED" }, { handle: "hidden_system", kind: "SYSTEM" },
    ] });
    expect((await discoverMusicians(parseMusicianFilters({}))).items.map((u) => u.handle)).toEqual(["human_player"]);
    expect(await risingMusicians(null)).toEqual([]);
  });

  it("pages alphabetically without overlap even when the previous last profile is removed", async () => {
    await prisma.user.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ handle: `player_${String(i).padStart(2, "0")}`, instruments: ["bass"], genres: ["jazz"] })) });
    const filters = parseMusicianFilters({ instrument: "bass", genre: "jazz" });
    const first = await discoverMusicians(filters);
    expect(first.items).toHaveLength(24);
    expect(first.nextCursor).toBe("player_23");
    await prisma.user.delete({ where: { handle: "player_23" } });
    const next = await discoverMusicians({ ...filters, after: first.nextCursor! });
    expect(next.items.map((u) => u.handle)).toEqual(["player_24", "player_25"]);
    expect(next.nextCursor).toBeNull();
  });

  it("treats SQL wildcard characters as literal search text", async () => {
    await makeActor({ handle: "mia_sax" });
    await makeActor({ handle: "miaxsax" });
    expect((await discoverMusicians(parseMusicianFilters({ q: "mia_sax" }))).items.map((u) => u.handle)).toEqual(["mia_sax"]);
    expect((await discoverMusicians(parseMusicianFilters({ q: "%" }))).items).toEqual([]);
  });

  it("excludes banned accounts from refreshed public aggregates", async () => {
    const banned = await makeActor();
    await createPost(banned, { ...base, body: "A hidden #bancheck" });
    await createTone(banned, { name: "Hidden tone", rig: { chain: [], notes: "x" }, visibility: "PUBLIC" });
    await prisma.user.update({ where: { id: banned.id }, data: { status: "BANNED" } });
    expect(await trendingTags(3)).toEqual([]);
    expect(await platformCounts()).toMatchObject({ posts: 0, tones: 0 });
  });
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
