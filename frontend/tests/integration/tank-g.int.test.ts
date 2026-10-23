import { beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers read the session from Auth.js; tests set it per call.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; sv: number } } }));
vi.mock("@/auth", () => ({ auth: async () => session.current }));
import type { Prisma } from "@prisma/client";
import { seed } from "@/prisma/seed";
import { batchConfirmation, generateDrafts, publishBatch, publishScheduledTones, reviewDraft, reviewDrafts, scheduleDrafts, setPublishingPaused, TANK_G_INITIAL_KEYS, unpublishDraft } from "@/lib/tone-drafts";
import { TANK_G_PRESETS } from "@/lib/tank-g-presets";
import { TONE_PRESETS } from "@/lib/tone-presets";
import { getTone, listTones, remixTone, setToneSaved } from "@/lib/tones";
import { tankGSheet, TANK_G_SLUG } from "@/lib/devices/tank-g";
import { GET as publicTones } from "@/app/api/tones/public/route";
import { GET as bankSheets } from "@/app/api/tones/tank-g-banks/route";
import sitemap from "@/app/sitemap";
import { deviceTones } from "@/lib/tones";
import { actorFor, makeActor, prisma, resetDb } from "./db";

async function setup() {
  const user = await makeActor();
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  const admin = await actorFor(user);
  await seed(prisma);
  await generateDrafts(admin);
  const tank = await prisma.toneDraft.findMany({ where: { key: { startsWith: "tank-g-" } }, orderBy: { key: "asc" } });
  const first = tank.filter(d => TANK_G_INITIAL_KEYS.includes(d.key));
  return { admin, tank, first, ids: (list: { id: string }[]) => list.map(d => d.id) };
}

async function approveAll(admin: Awaited<ReturnType<typeof setup>>["admin"], ids: string[]) {
  for (let i = 0; i < ids.length; i += 40) await reviewDrafts(admin, ids.slice(i, i + 40), true);
}

beforeEach(async () => { session.current = null; await resetDb(); });

describe("TANK-G library publishing", () => {
  it("generates every validated preset once, tone-only, under existing managed creators", async () => {
    const { admin, tank } = await setup();
    expect(tank).toHaveLength(TANK_G_PRESETS.length);
    expect(await prisma.toneDraft.count()).toBe(TONE_PRESETS.length + TANK_G_PRESETS.length);
    expect(tank.every(d => d.communityId === null && d.status === "DRAFT")).toBe(true);
    expect(await prisma.managedCreator.count()).toBe(6);
    expect(new Set(tank.map(d => d.creatorId)).size).toBeGreaterThanOrEqual(4);
    expect(await generateDrafts(admin)).toEqual({ created: 0 });
    expect(await prisma.gearItem.count({ where: { slug: TANK_G_SLUG, status: "APPROVED" } })).toBe(1);
  });

  it("enforces admin permissions and explicit confirmation on every bulk operation", async () => {
    const { admin, first, ids } = await setup();
    const member = await makeActor();
    await expect(reviewDrafts(member, ids(first), true)).rejects.toThrow("Only active administrators");
    await expect(reviewDrafts({ ...member, role: "ADMIN" }, ids(first), true)).rejects.toThrow("Only active administrators");
    await expect(publishBatch(member, ids(first), batchConfirmation(36))).rejects.toThrow("Only active administrators");
    await expect(reviewDrafts(admin, [], true)).rejects.toThrow("Choose 1–40");
    await expect(reviewDrafts(admin, Array.from({ length: 41 }, (_, i) => `d${i}`), true)).rejects.toThrow("Choose 1–40");
    await approveAll(admin, ids(first));
    await expect(publishBatch(admin, ids(first), "yes")).rejects.toThrow("Confirm with");
    expect(await prisma.tone.count()).toBe(0);
  });

  it("refuses an unreviewed batch atomically, then publishes once and is idempotent", async () => {
    const { admin, first, ids } = await setup();
    await approveAll(admin, ids(first.slice(1)));
    await expect(publishBatch(admin, ids(first), batchConfirmation(36))).rejects.toThrow("reviewed and approved");
    expect(await prisma.tone.count()).toBe(0);
    await reviewDraft(admin, first[0].id, true);
    const result = await publishBatch(admin, ids(first), batchConfirmation(36));
    expect(result).toMatchObject({ published: 36, skipped: 0 });
    expect(await publishBatch(admin, ids(first), batchConfirmation(36))).toMatchObject({ published: 0, skipped: 36 });
    expect(await prisma.tone.count()).toBe(36);
    expect(await prisma.post.count()).toBe(0);
    expect(await prisma.tonePublishingEvent.count({ where: { action: "published", source: "IMPORT" } })).toBe(36);
    expect(await prisma.auditLog.count({ where: { action: "tone.publishing.batch" } })).toBe(2);
    // The batch never consumes the daily automation budget.
    expect(await prisma.tonePublishingEvent.count({ where: { source: "AUTO" } })).toBe(0);
    const tones = await prisma.tone.findMany({ include: { gear: { include: { gear: true } }, user: true } });
    for (const t of tones) {
      expect(t).toMatchObject({ origin: "GENERATED", visibility: "PUBLIC", saveCount: 0, remixCount: 0 });
      expect(t.user.kind).toBe("SYSTEM");
      expect(t.description).toContain("Resoniq-generated");
      expect(t.gear.some(g => g.gear.slug === TANK_G_SLUG)).toBe(true);
    }
  });

  it("is discoverable by device metadata: gear, collection, amp slot, effect, genre and search", async () => {
    const { admin, first, ids } = await setup();
    await approveAll(admin, ids(first));
    await publishBatch(admin, ids(first), batchConfirmation(36));
    const gear = await prisma.gearItem.findUniqueOrThrow({ where: { slug: TANK_G_SLUG } });
    const all = await listTones(null, { sort: "popular", gearId: gear.id, cursor: null, limit: 50 });
    expect(all.items).toHaveLength(36);
    const published = TANK_G_PRESETS.filter(p => TANK_G_INITIAL_KEYS.includes(p.key));
    const count = async (q: Partial<Parameters<typeof listTones>[1]>) => (await listTones(null, { sort: "new", gearId: gear.id, cursor: null, limit: 50, ...q })).items.length;
    expect(await count({ collection: "metal" })).toBe(9);
    expect(await count({ ampSlot: 9 })).toBe(published.filter(p => p.device!.ampSlot === 9).length);
    expect(await count({ effect: "Cloud" })).toBe(published.filter(p => p.chain.some(b => b.params.Type === "Cloud")).length);
    expect(await count({ genre: "worship" })).toBe(published.filter(p => p.genres.includes("worship")).length);
    expect(await count({ q: "Crystal" })).toBe(1);
    // Paginates instead of returning the whole catalog.
    const page = await listTones(null, { sort: "new", gearId: gear.id, cursor: null, limit: 10 });
    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).toBeTruthy();
    const res = await publicTones(new Request(`http://test/api/tones/public?gear=${gear.id}&amp=9&effect=Shimmer&collection=nope&limit=50`), { params: Promise.resolve({}) } as never);
    expect((await res.json()).items).toHaveLength(published.filter(p => p.device!.ampSlot === 9).length);
  });

  it("saves and remixes with provenance and device metadata intact", async () => {
    const { admin, first, ids } = await setup();
    await approveAll(admin, ids(first));
    const { toneIds } = await publishBatch(admin, ids(first), batchConfirmation(36));
    const member = await makeActor();
    await setToneSaved(member, toneIds[0], true);
    const remixId = await remixTone(member, toneIds[0]);
    const remix = (await getTone(remixId, member.id))!;
    expect(remix.origin).toBe("generated");
    expect(remix.remixOf?.id).toBe(toneIds[0]);
    expect(tankGSheet(remix.declared!)).toHaveLength(15);
    expect((await prisma.tone.findUniqueOrThrow({ where: { id: toneIds[0] } }))).toMatchObject({ saveCount: 1, remixCount: 1 });
  });

  it("queues the rest for automation at no more than two per UTC day, and only while enabled", async () => {
    const { admin, tank, first, ids } = await setup();
    const rest = tank.filter(d => !first.includes(d)).slice(0, 5);
    await approveAll(admin, ids(rest));
    const when = new Date(Date.now() + 60_000);
    expect(await scheduleDrafts(admin, ids(rest), when.toISOString())).toEqual({ changed: 5 });
    const later = new Date(when.getTime() + 60_000);
    expect(await publishScheduledTones(later)).toEqual({ published: 0, failures: 0 });
    await setPublishingPaused(admin, false);
    expect(await publishScheduledTones(later)).toEqual({ published: 2, failures: 0 });
    expect(await publishScheduledTones(later)).toEqual({ published: 0, failures: 0 });
    expect(await prisma.tone.count()).toBe(2);
  });

  it("re-validates on approval and unpublishes cleanly", async () => {
    const { admin, first, ids } = await setup();
    const bad = first[0];
    const rig = bad.rig as { chain: { params: Record<string, unknown> }[] };
    rig.chain[rig.chain.length - 1].params.Type = "Shimmer";
    await prisma.toneDraft.update({ where: { id: bad.id }, data: { rig: rig as unknown as Prisma.InputJsonValue } });
    await expect(reviewDrafts(admin, [bad.id], true)).rejects.toThrow("TANK-G");
    expect((await prisma.toneDraft.findUniqueOrThrow({ where: { id: bad.id } })).status).toBe("DRAFT");
    const good = first.slice(1, 3);
    await approveAll(admin, ids(good));
    const { toneIds } = await publishBatch(admin, ids(good), batchConfirmation(2));
    await unpublishDraft(admin, good[0].id);
    expect((await prisma.tone.findUniqueOrThrow({ where: { id: toneIds[0] } })).visibility).toBe("PRIVATE");
    const gear = await prisma.gearItem.findUniqueOrThrow({ where: { slug: TANK_G_SLUG } });
    expect((await listTones(null, { sort: "new", gearId: gear.id, cursor: null, limit: 10 })).items).toHaveLength(1);
  });

  it("plans banks from the viewer's own and saved presets only, and exports their sheets", async () => {
    const { admin, first, ids } = await setup();
    await approveAll(admin, ids(first));
    const { toneIds } = await publishBatch(admin, ids(first), batchConfirmation(36));
    const gear = await prisma.gearItem.findUniqueOrThrow({ where: { slug: TANK_G_SLUG } });
    const member = await makeActor();
    const other = await makeActor();
    await setToneSaved(member, toneIds[0], true);
    await setToneSaved(member, toneIds[1], true);
    await setToneSaved(other, toneIds[2], true);
    const own = await remixTone(member, toneIds[3]);
    await prisma.tone.update({ where: { id: toneIds[4] }, data: { visibility: "PRIVATE" } });
    await setToneSaved(member, toneIds[5], true);
    await prisma.tone.update({ where: { id: toneIds[5] }, data: { visibility: "PRIVATE" } });
    const mine = await deviceTones(member.id, gear.id);
    expect(mine.map(t => t.id).sort()).toEqual([toneIds[0], toneIds[1], own].sort());

    expect((await bankSheets(new Request("http://test/api/tones/tank-g-banks"), { params: Promise.resolve({}) } as never)).status).toBe(401);
    session.current = { user: { id: member.id, sv: 0 } };
    const res = await bankSheets(new Request("http://test/api/tones/tank-g-banks"), { params: Promise.resolve({}) } as never);
    expect(res.headers.get("content-disposition")).toContain("tank-g-banks.txt");
    const text = await res.text();
    expect(text.match(/===== Bank \d[A-D] =====/g)).toHaveLength(3);
    expect(text).toContain("===== Bank 1A =====");
    expect(text).toContain("Resoniq-generated");

    // A planner order is honoured; someone else's or unknown presets are ignored; blanks leave slots empty.
    const planned = await bankSheets(new Request(`http://test/api/tones/tank-g-banks?order=,${own},${toneIds[2]},nope,${toneIds[0]}`), { params: Promise.resolve({}) } as never);
    const plannedText = await planned.text();
    expect(plannedText.match(/===== Bank \d[A-D] =====/g)).toEqual(["===== Bank 1B =====", "===== Bank 2A ====="]);
    expect(plannedText).not.toContain(`/t/${toneIds[2]}`);
  });

  it("lists public tones and the TANK-G page in the sitemap, never private ones", async () => {
    const { admin, first, ids } = await setup();
    await approveAll(admin, ids(first.slice(0, 2)));
    const { toneIds } = await publishBatch(admin, ids(first.slice(0, 2)), batchConfirmation(2));
    await prisma.tone.update({ where: { id: toneIds[1] }, data: { visibility: "PRIVATE" } });
    const urls = (await sitemap()).map(e => e.url);
    expect(urls.some(u => u.endsWith(`/gear/${TANK_G_SLUG}`))).toBe(true);
    expect(urls.some(u => u.endsWith(`/t/${toneIds[0]}`))).toBe(true);
    expect(urls.some(u => u.endsWith(`/t/${toneIds[1]}`))).toBe(false);
    expect(urls.filter(u => u.includes("/c/"))).toHaveLength(20);
  });
});
