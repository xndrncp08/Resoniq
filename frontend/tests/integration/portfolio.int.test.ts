import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; sv: number } } }));
vi.mock("@/auth", () => ({ auth: async () => session.current }));
import { PATCH } from "@/app/api/me/route";
import { PUT as putRig } from "@/app/api/me/rig/route";
import { getShowcase } from "@/lib/portfolio";
import { playMates } from "@/lib/discovery";
import { makeUser, prisma, resetDb } from "./db";

beforeEach(async () => { session.current = null; await resetDb(); });

const json = (method: string, body: unknown) => new Request("http://localhost/api/me", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const patch = (body: unknown) => PATCH(json("PATCH", body), undefined);
const rig = (items: unknown) => putRig(json("PUT", { items }), undefined);
const signIn = async (data: Record<string, unknown> = {}) => {
  const u = await makeUser();
  await prisma.user.update({ where: { id: u.id }, data });
  session.current = { user: { id: u.id, sv: 0 } };
  return u.id;
};
const post = (authorId: string, status: "PUBLISHED" | "DELETED" = "PUBLISHED") => prisma.post.create({ data: { authorId, body: "A take", status } });
const tone = (userId: string, data: Record<string, unknown> = {}) => prisma.tone.create({ data: { userId, name: "Lead", visibility: "PUBLIC", ...data } });
const gear = (model: string, status: "APPROVED" | "PENDING" | "REJECTED" = "APPROVED", createdById?: string) =>
  prisma.gearItem.create({ data: { slug: `test-${model.toLowerCase()}`, kind: "PEDAL", brand: "Test", model, status, createdById } });

describe("portfolio fields", () => {
  it("saves what a musician is open to, their location and influences", async () => {
    const id = await signIn();
    const res = await patch({ openTo: ["band", "jam", "band"], location: "  Manila ", influences: ["Carol Kaye", "carol kaye", " Nai  Palm "] });
    expect(res.status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id }, select: { openTo: true, location: true, influences: true } })).toEqual({ openTo: ["band", "jam"], location: "Manila", influences: ["Carol Kaye", "Nai Palm"] });
  });

  it("rejects unknown options and markup", async () => {
    await signIn();
    expect((await patch({ openTo: ["anything"] })).status).toBe(400);
    expect((await patch({ influences: ["<script>"] })).status).toBe(400);
    expect((await patch({ influences: Array.from({ length: 9 }, (_, i) => `Artist ${i}`) })).status).toBe(400);
  });
});

describe("pins", () => {
  it("only pins the member's own published post and own public, credited tone", async () => {
    const id = await signIn();
    const other = await makeUser();
    const [mine, theirs, deleted] = await Promise.all([post(id), post(other.id), post(id, "DELETED")]);
    const [publicTone, privateTone, anonymous, theirTone] = await Promise.all([tone(id), tone(id, { visibility: "UNLISTED" }), tone(id, { anonymous: true }), tone(other.id)]);
    for (const pinnedPostId of [theirs.id, deleted.id]) expect((await patch({ pinnedPostId })).status).toBe(400);
    for (const signatureToneId of [privateTone.id, anonymous.id, theirTone.id]) expect((await patch({ signatureToneId })).status).toBe(400);
    expect((await patch({ pinnedPostId: mine.id, signatureToneId: publicTone.id })).status).toBe(200);
    const showcase = await getShowcase(id, null);
    expect([showcase.pinnedPost?.id, showcase.signatureTone?.id]).toEqual([mine.id, publicTone.id]);
  });

  it("drops a pin from the profile once the post is deleted or the tone goes private", async () => {
    const id = await signIn();
    const [p, t] = await Promise.all([post(id), tone(id)]);
    await patch({ pinnedPostId: p.id, signatureToneId: t.id });
    await prisma.post.update({ where: { id: p.id }, data: { status: "DELETED" } });
    await prisma.tone.update({ where: { id: t.id }, data: { visibility: "PRIVATE" } });
    const showcase = await getShowcase(id, null);
    expect([showcase.pinnedPost, showcase.signatureTone]).toEqual([null, null]);
  });
});

describe("rig", () => {
  it("replaces the rig in order, from catalog gear and the member's own pending submissions", async () => {
    const id = await signIn();
    const [a, b, pending] = await Promise.all([gear("Alpha"), gear("Bravo"), gear("Mine", "PENDING", id)]);
    expect((await rig([{ gearId: b.id, note: " always on " }, { gearId: a.id }, { gearId: pending.id }])).status).toBe(200);
    const { rig: listed } = await getShowcase(id, null);
    expect(listed.map((r) => [r.gear.model, r.note])).toEqual([["Bravo", "always on"], ["Alpha", null], ["Mine", null]]);
    expect((await rig([{ gearId: a.id }])).status).toBe(200);
    expect((await getShowcase(id, null)).rig.map((r) => r.gear.model)).toEqual(["Alpha"]);
  });

  it("refuses unknown, rejected or someone else's pending gear, and duplicates", async () => {
    const id = await signIn();
    const other = await makeUser();
    const [rejected, theirs, ok] = await Promise.all([gear("Gone", "REJECTED"), gear("Theirs", "PENDING", other.id), gear("Fine")]);
    for (const items of [[{ gearId: "nope" }], [{ gearId: rejected.id }], [{ gearId: theirs.id }], [{ gearId: ok.id }, { gearId: ok.id }]]) expect((await rig(items)).status).toBe(400);
    expect(await prisma.userGear.count({ where: { userId: id } })).toBe(0);
  });

  it("needs a signed-in member", async () => {
    expect((await rig([])).status).toBe(401);
  });
});

describe("players to play with", () => {
  it("suggests open musicians who share a genre and cover a part the viewer doesn't", async () => {
    const me = await makeUser();
    await prisma.user.update({ where: { id: me.id }, data: { instruments: ["electric-guitar"], genres: ["metal", "prog"], openTo: ["band"], location: "Manila" } });
    const make = async (handle: string, data: Record<string, unknown>) => {
      const u = await makeUser({ handle });
      await prisma.user.update({ where: { id: u.id }, data });
      return u;
    };
    await make("drummer_near", { instruments: ["drums"], genres: ["metal", "prog"], openTo: ["band"], location: "manila " });
    await make("bassist", { instruments: ["bass"], genres: ["prog"], openTo: ["remote"] });
    await make("guitarist", { instruments: ["acoustic-guitar"], genres: ["metal"], openTo: ["band"] });
    await make("not_open", { instruments: ["keys"], genres: ["metal"] });
    await make("other_genre", { instruments: ["drums"], genres: ["jazz"], openTo: ["jam"] });
    const followed = await make("followed", { instruments: ["vocals"], genres: ["metal"], openTo: ["band"] });
    await prisma.follow.create({ data: { followerId: me.id, followingId: followed.id } });

    const { items } = await playMates(me.id);
    expect(items.map((u) => u.handle)).toEqual(["drummer_near", "bassist"]);
    expect(items[0].why).toEqual({ plays: ["drums"], genres: ["metal", "prog"], near: true });
  });

  it("asks for instruments and genres first", async () => {
    const me = await makeUser();
    expect(await playMates(me.id)).toEqual({ items: [], missing: "instruments" });
  });
});
