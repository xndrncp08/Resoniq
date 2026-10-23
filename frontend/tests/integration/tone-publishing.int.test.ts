import { beforeEach, describe, expect, it } from "vitest";
import { seed } from "@/prisma/seed";
import { generateDrafts, editDraft, editManagedCreator, importInitialTones, INITIAL_IMPORT_CONFIRMATION, INITIAL_PRESET_KEYS, publishDraft, publishScheduledTones, reviewDraft, scheduleDraft, setPublishingPaused, unpublishDraft } from "@/lib/tone-drafts";
import { getTone, listTones, remixTone, setToneSaved, updateTone } from "@/lib/tones";
import { getPost } from "@/lib/posts";
import { getPublicProfile } from "@/lib/profiles";
import { searchTones, searchMusicians } from "@/lib/search";
import { setUserRole } from "@/lib/admin/users";
import { notify } from "@/lib/notify";
import { systemPublisherId } from "@/lib/system-identity";
import { actorFor, makeActor, prisma, resetDb } from "./db";

async function setup() {
  const user = await makeActor();
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  const admin = await actorFor(user);
  await seed(prisma);
  await generateDrafts(admin);
  const drafts = await prisma.toneDraft.findMany({ orderBy: { key: "asc" } });
  return { admin, drafts };
}

beforeEach(resetDb);

describe("managed tone publishing", () => {
  it("refuses a pre-existing member handle instead of converting or overwriting it", async () => {
    const member = await makeActor({ handle: "resoniq_clara", name: "Existing member" });
    const adminUser = await makeActor();
    await prisma.user.update({ where: { id: adminUser.id }, data: { role: "ADMIN" } });
    await seed(prisma);
    await expect(generateDrafts(await actorFor(adminUser))).rejects.toThrow("already in use");
    expect(await prisma.user.findUnique({ where: { id: member.id } })).toMatchObject({ name: "Existing member", kind: "PERSON" });
    expect(await prisma.managedCreator.count()).toBe(0);
    expect(await prisma.toneDraft.count()).toBe(0);
  });
  it("generates validated drafts once and never overwrites genuine accounts or content", async () => {
    const member = await makeActor({ handle: "real_musician", name: "Real musician" });
    const { admin, drafts } = await setup();
    expect(drafts).toHaveLength(28);
    expect(await prisma.managedCreator.count()).toBe(6);
    expect(await generateDrafts(admin)).toEqual({ created: 0 });
    expect(await prisma.tone.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: member.id } })).toMatchObject({ name: "Real musician", kind: "PERSON" });
    expect(await prisma.gearItem.count()).toBe(137);
    expect(await prisma.community.count()).toBe(20);
    expect(await prisma.tonePublishingControl.findUnique({ where: { id: "default" } })).toMatchObject({ paused: true });
  });

  it("cannot sign in, hold privileges or convert a member identity", async () => {
    const { admin } = await setup();
    const creator = await prisma.managedCreator.findFirstOrThrow({ include: { user: true } });
    expect(creator.user).toMatchObject({ email: null, passwordHash: null, kind: "SYSTEM", role: "USER" });
    expect(creator.user.name).toContain("Demo Creator");
    expect(creator.user.bio).toContain("not an independent musician");
    await expect(prisma.user.update({ where: { id: creator.userId }, data: { passwordHash: "hash" } })).rejects.toThrow();
    await expect(prisma.user.update({ where: { id: creator.userId }, data: { role: "ADMIN" } })).rejects.toThrow();
    await expect(prisma.user.update({ where: { id: creator.userId }, data: { kind: "PERSON" } })).rejects.toThrow();
    await expect(prisma.account.create({ data: { userId: creator.userId, type: "oauth", provider: "google", providerAccountId: "demo" } })).rejects.toThrow();
    await expect(prisma.session.create({ data: { userId: creator.userId, sessionToken: "demo", expires: new Date(Date.now() + 60_000) } })).rejects.toThrow();
    await expect(setUserRole(admin, creator.userId, "ADMIN")).rejects.toThrow("System identities");
    const member = await makeActor();
    await expect(prisma.managedCreator.create({ data: { userId: member.id, specialization: "x" } })).rejects.toThrow();
    await expect(generateDrafts(await actorFor(creator.user))).rejects.toThrow("Only active administrators");
    await notify({ userId: creator.userId, type: "MODERATION", data: { reason: "No system inbox" } });
    expect(await prisma.notification.count()).toBe(0);
  });

  it("refuses spoofed permissions and suspended or demoted admins without side effects", async () => {
    const { admin, drafts } = await setup();
    const member = await makeActor();
    await expect(reviewDraft({ ...member, role: "ADMIN" }, drafts[0].id, true)).rejects.toThrow("Only active administrators");
    await expect(publishDraft(member, drafts[0].id)).rejects.toThrow("Only active administrators");
    await prisma.user.update({ where: { id: admin.id }, data: { status: "BANNED" } });
    await expect(setPublishingPaused(admin, false)).rejects.toThrow("Only active administrators");
    expect(await prisma.tonePublishingEvent.count({ where: { action: "failed" } })).toBe(0);
  });

  it("publishes atomically and idempotently, with searchable attribution and a community discussion", async () => {
    const { admin, drafts } = await setup();
    const draft = drafts.find(d => d.key === "ambient-worship-swells")!;
    await reviewDraft(admin, draft.id, true);
    const ids = await Promise.all([publishDraft(admin, draft.id), publishDraft(admin, draft.id)]);
    expect(ids[0]).toBe(ids[1]);
    expect(await prisma.tone.count()).toBe(1);
    expect(await prisma.post.count()).toBe(1);
    expect(await prisma.tonePublishingEvent.count({ where: { action: "published" } })).toBe(1);
    const tone = (await getTone(ids[0], null))!;
    expect(tone).toMatchObject({ origin: "generated", anonymous: false, visibility: "PUBLIC", author: { handle: "resoniq_aura", managedCreator: { id: draft.creatorId } }, saveCount: 0, remixCount: 0 });
    expect(tone.description).toContain("not tested");
    const profile = (await getPublicProfile(tone.author.handle, null))!;
    expect(profile.managed).toBe(true);
    expect((await listTones(null, { sort: "new", cursor: null, limit: 40, genre: "worship", source: "generated" })).items).toHaveLength(1);
    expect((await searchTones("worship", null, 0, 20, "generated")).map(t => t.id)).toContain(ids[0]);
    expect((await searchMusicians("resoniq_aura")).map(u => u.id)).toContain(tone.author.id);
    const current = await prisma.toneDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect((await getPost(current.postId!, null))!.body).toContain("Resoniq-managed demo creator");
    expect((await getPost(current.postId!, null))!.tone).toMatchObject({ origin: "generated" });
    const community = await prisma.community.findUniqueOrThrow({ where: { id: draft.communityId! } });
    expect(community.postCount).toBe(1);
    const member = await makeActor();
    await expect(updateTone(member, ids[0], { name: "stolen" })).rejects.toThrow("not found");
  });

  it("preserves generated provenance and source credit through saving and remixing", async () => {
    const { admin, drafts } = await setup();
    await reviewDraft(admin, drafts[0].id, true);
    const id = await publishDraft(admin, drafts[0].id);
    const member = await makeActor();
    await setToneSaved(member, id, true); await setToneSaved(member, id, true);
    const remix = await remixTone(member, id);
    expect(await getTone(remix, member.id)).toMatchObject({ origin: "generated", visibility: "UNLISTED", remixOf: { id } });
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.tone.findUnique({ where: { id } })).toMatchObject({ saveCount: 1, remixCount: 1 });
  });

  it("resets approval after edits, validates catalog references and rejects duplicate rigs", async () => {
    const { admin, drafts } = await setup();
    const d = drafts[0];
    await expect(publishDraft(admin, d.id)).rejects.toThrow("Approve");
    await reviewDraft(admin, d.id, true);
    await editDraft(admin, d.id, { ...d, name: "Updated" });
    expect(await prisma.toneDraft.findUnique({ where: { id: d.id } })).toMatchObject({ status: "DRAFT", reviewedAt: null });
    await expect(editDraft(admin, d.id, { ...drafts[1], name: "Renamed duplicate" })).rejects.toThrow("identical rig");
    await expect(editDraft(admin, d.id, { ...d, rig: { ...(d.rig as object), amp: { ref: { model: "Missing", gearId: "missing" }, settings: {} } } })).rejects.toThrow("missing or unapproved");
    await reviewDraft(admin, d.id, false);
    await expect(publishDraft(admin, d.id)).rejects.toThrow("Approve");
  });

  it("preserves legacy anonymous attribution and refuses to duplicate an existing generated tone", async () => {
    const { admin, drafts } = await setup();
    const d = drafts[0];
    const userId = await systemPublisherId();
    const legacy = await prisma.tone.create({ data: { userId, name: "Existing anonymous preset", origin: "GENERATED", anonymous: true, visibility: "PUBLIC", rig: d.rig! } });
    expect(await getTone(legacy.id, null)).toMatchObject({ anonymous: true, origin: "generated", author: { id: "anonymous", name: "Anonymous" } });
    expect(await getPublicProfile("anonymous", null)).toBeNull();
    await reviewDraft(admin, d.id, true);
    await expect(publishDraft(admin, d.id)).rejects.toThrow("already exists");
    expect(await prisma.tone.count()).toBe(1);
    expect(await prisma.post.count()).toBe(0);
  });

  it("rolls back partial publishing and records retryable failure history", async () => {
    const { admin, drafts } = await setup();
    const d = drafts[0];
    await reviewDraft(admin, d.id, true);
    await prisma.community.update({ where: { id: d.communityId! }, data: { archivedAt: new Date() } });
    await expect(publishDraft(admin, d.id)).rejects.toThrow("active community");
    expect(await prisma.tone.count()).toBe(0); expect(await prisma.post.count()).toBe(0);
    expect(await prisma.toneDraft.findUnique({ where: { id: d.id } })).toMatchObject({ status: "FAILED" });
    expect(await prisma.tonePublishingEvent.count({ where: { action: "failed" } })).toBe(1);
    await prisma.community.update({ where: { id: d.communityId! }, data: { archivedAt: null } });
    await publishDraft(admin, d.id);
    expect(await prisma.tone.count()).toBe(1);
  });

  it("withdraws and removes content without recreating duplicates or corrupting community counts", async () => {
    const { admin, drafts } = await setup();
    const d = drafts[0]; await reviewDraft(admin, d.id, true);
    const id = await publishDraft(admin, d.id);
    const published = await prisma.toneDraft.findUniqueOrThrow({ where: { id: d.id } });
    await unpublishDraft(admin, d.id); await unpublishDraft(admin, d.id);
    expect(await getTone(id, null)).toBeNull();
    expect(await getPost(published.postId!, null)).toBeNull();
    expect((await prisma.community.findUniqueOrThrow({ where: { id: d.communityId! } })).postCount).toBe(0);
    await editDraft(admin, d.id, { ...d, description: "Revised suggested starting point" });
    await reviewDraft(admin, d.id, true); expect(await publishDraft(admin, d.id)).toBe(id);
    expect((await getTone(id, null))!.description).toContain("Revised suggested starting point");
    expect(await prisma.post.count()).toBe(1);
    await unpublishDraft(admin, d.id, true);
    expect(await prisma.tone.count()).toBe(0);
    expect(await prisma.tonePublishingEvent.count({ where: { action: "removed", toneId: id } })).toBe(1);
    await expect(reviewDraft(admin, d.id, true)).rejects.toThrow();
    expect(await generateDrafts(admin)).toEqual({ created: 0 });
  });

  it("imports exactly 26 reviewed tones once, leaving the two optional variations as drafts", async () => {
    const { admin, drafts } = await setup();
    await expect(importInitialTones(admin, "yes")).rejects.toThrow("Confirm");
    await expect(importInitialTones(admin, INITIAL_IMPORT_CONFIRMATION)).rejects.toThrow("individually reviewed");
    for (const d of drafts.filter(d => INITIAL_PRESET_KEYS.includes(d.key))) await reviewDraft(admin, d.id, true);
    const result = await importInitialTones(admin, INITIAL_IMPORT_CONFIRMATION);
    expect(result.imported).toBe(26);
    expect((await importInitialTones(admin, INITIAL_IMPORT_CONFIRMATION)).imported).toBe(0);
    expect(await prisma.tone.count({ where: { origin: "GENERATED", visibility: "PUBLIC" } })).toBe(26);
    expect(await prisma.toneDraft.count({ where: { status: "DRAFT" } })).toBe(2);
    expect(await prisma.tonePublishingEvent.count({ where: { source: "AUTO", action: "published" } })).toBe(0);
    expect(await prisma.user.count({ where: { kind: "SYSTEM", tones: { some: {} } } })).toBe(6);
  });

  it("rolls back the whole initial batch and records the failing draft", async () => {
    const { admin, drafts } = await setup();
    for (const d of drafts.filter(d => INITIAL_PRESET_KEYS.includes(d.key))) await reviewDraft(admin, d.id, true);
    const target = drafts.find(d => d.key === "vintage-p-bass-thump")!;
    await prisma.community.update({ where: { id: target.communityId! }, data: { archivedAt: new Date() } });
    await expect(importInitialTones(admin, INITIAL_IMPORT_CONFIRMATION)).rejects.toThrow("active community");
    expect(await prisma.tone.count()).toBe(0);
    expect(await prisma.post.count()).toBe(0);
    expect(await prisma.tonePublishingEvent.count({ where: { source: "IMPORT", action: "failed" } })).toBe(1);
    expect((await prisma.tonePublishingControl.findUniqueOrThrow({ where: { id: "default" } })).initialImportAt).toBeNull();
  });

  it("enforces pause and a two-per-UTC-day budget across concurrent cron calls and withdrawals", async () => {
    const { admin, drafts } = await setup();
    const future = new Date(Date.now() + 100_000);
    for (const d of drafts.slice(0, 4)) { await reviewDraft(admin, d.id, true); await scheduleDraft(admin, d.id, future.toISOString()); }
    expect(await publishScheduledTones(future)).toEqual({ published: 0, failures: 0 });
    await setPublishingPaused(admin, false);
    await Promise.all([publishScheduledTones(future), publishScheduledTones(future), publishScheduledTones(future)]);
    expect(await prisma.tone.count()).toBe(2);
    const published = await prisma.toneDraft.findFirstOrThrow({ where: { status: "PUBLISHED" } });
    await unpublishDraft(admin, published.id);
    expect((await publishScheduledTones(future)).published).toBe(0);
    const nextDay = new Date(future.getTime() + 86_400_000);
    expect((await publishScheduledTones(nextDay)).published).toBe(2);
    expect(await prisma.tone.count()).toBe(4);
  });

  it("pauses individual creators and records scheduled failures safely for a later retry", async () => {
    const { admin, drafts } = await setup();
    const d = drafts[0]; await reviewDraft(admin, d.id, true);
    const future = new Date(Date.now() + 100_000);
    await scheduleDraft(admin, d.id, future.toISOString()); await setPublishingPaused(admin, false);
    await editManagedCreator(admin, d.creatorId!, { enabled: false, specialization: "Paused for review" });
    expect((await publishScheduledTones(future)).published).toBe(0);
    await editManagedCreator(admin, d.creatorId!, { enabled: true, specialization: "Bass and guitar" });
    await prisma.community.update({ where: { id: d.communityId! }, data: { archivedAt: new Date() } });
    expect(await publishScheduledTones(future)).toEqual({ published: 0, failures: 1 });
    await prisma.community.update({ where: { id: d.communityId! }, data: { archivedAt: null } });
    expect((await publishScheduledTones(future)).published).toBe(1);
    expect((await publishScheduledTones(future)).published).toBe(0);
  });
}, 30_000);
