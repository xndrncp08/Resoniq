import type { Prisma, ToneDraft } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { creatorHandleFor, ensureManagedCreators } from "@/lib/managed-creators";
import { parseDraftInput, presetRig, rigFingerprint, validateDraftReferences, type DraftInput } from "@/lib/tone-draft-validation";
import { parseRig } from "@/lib/rig-validation";
import { TONE_PRESETS } from "@/lib/tone-presets";
import { TANK_G_PRESETS } from "@/lib/tank-g-presets";
import { GENERATED_DISCLOSURE } from "@/lib/tones";
import { hotRank } from "@/lib/ranking";

type Tx = Prisma.TransactionClient;
type Source = "MANUAL" | "AUTO" | "IMPORT";
// The final two acoustic-simulation variations remain drafts for a later review.
export const INITIAL_PRESET_KEYS = TONE_PRESETS.slice(0, 26).map(p => p.key);
export const INITIAL_IMPORT_CONFIRMATION = "Publish the 26 reviewed Resoniq demo tones";
export const ALL_PRESETS = [...TONE_PRESETS, ...TANK_G_PRESETS];
// The first nine of each TANK-G collection: one full 36-slot (9 banks × A–D) set.
export const TANK_G_INITIAL_KEYS = Object.values(Object.groupBy(TANK_G_PRESETS, p => p.device!.collection)).flatMap(list => list!.slice(0, 9).map(p => p.key));
export const MAX_BATCH = 40;
export const batchConfirmation = (count: number) => `Publish ${count} reviewed Resoniq tones`;

async function lock(tx: Tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(723914, 26)::text`;
}

async function assertAdmin(tx: Tx, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.id } });
  if (!user || user.role !== "ADMIN" || user.kind !== "PERSON" || user.status === "BANNED" || (user.status === "SUSPENDED" && (!user.suspendedUntil || user.suspendedUntil > new Date()))) throw new ApiError(403, "Only active administrators can manage tone publishing.");
}

async function adminTx<T>(actor: Actor, run: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await lock(tx);
    await assertAdmin(tx, actor);
    return run(tx);
  }, { maxWait: 10_000, timeout: 45_000 });
}

async function event(tx: Tx, draft: { id: string; toneId: string | null }, action: string, source: Source, actorId: string | null, error?: string, at?: Date) {
  await tx.tonePublishingEvent.create({ data: { draftId: draft.id, toneId: draft.toneId, action, source, error, createdAt: at } });
  await recordAudit(tx, { actorId, action: `tone.draft.${action}`, targetType: "ToneDraft", targetId: draft.id, meta: { source, toneId: draft.toneId, ...(error && { error }) } });
}

async function findDraft(tx: Tx, id: string) {
  const draft = await tx.toneDraft.findUnique({ where: { id } });
  if (!draft) throw new ApiError(404, "Draft not found.");
  return draft;
}

async function control(tx: Tx) {
  return tx.tonePublishingControl.upsert({ where: { id: "default" }, create: { id: "default", paused: true }, update: {} });
}

function draftInput(draft: ToneDraft): DraftInput {
  return parseDraftInput({ ...draft, rig: draft.rig });
}

export async function generateDrafts(actor: Actor) {
  return adminTx(actor, async tx => {
    await ensureManagedCreators(tx);
    const creators = await tx.managedCreator.findMany({ include: { user: true } });
    const communities = await tx.community.findMany({ where: { archivedAt: null } });
    let created = 0;
    for (const preset of ALL_PRESETS) {
      if (await tx.toneDraft.findUnique({ where: { key: preset.key } })) continue;
      const creator = creators.find(c => c.user.handle === creatorHandleFor(preset.key, preset.instrument, preset.genres))!;
      const community = communities.find(c => c.slug === (preset.instrument === "BASS" ? "bass" : preset.genres.find(g => communities.some(c => c.slug === g)) ?? "electric-guitar"));
      // Device presets are tone-only so a large library never floods community feeds.
      const input = parseDraftInput({ name: preset.name, description: preset.description, rig: await presetRig(tx, preset), creatorId: creator.id, communityId: preset.device ? null : community?.id ?? null });
      await validateDraftReferences(tx, input);
      if (await tx.toneDraft.findUnique({ where: { fingerprint: input.fingerprint } })) continue;
      const draft = await tx.toneDraft.create({ data: { ...input, key: preset.key, rig: input.rig as Prisma.InputJsonValue } });
      await event(tx, draft, "generated", "MANUAL", actor.id);
      created++;
    }
    await control(tx);
    await recordAudit(tx, { actorId: actor.id, action: "tone.creators.ensure", targetType: "ManagedCreator", targetId: "Resoniq", meta: { createdDrafts: created } });
    return { created };
  });
}

export async function editDraft(actor: Actor, id: string, body: Record<string, unknown>) {
  const input = parseDraftInput(body);
  return adminTx(actor, async tx => {
    const draft = await findDraft(tx, id);
    if (draft.status === "PUBLISHED" || draft.removedAt) throw new ApiError(409, "Unpublish a tone before editing its draft.");
    await validateDraftReferences(tx, input);
    if (await tx.toneDraft.findFirst({ where: { fingerprint: input.fingerprint, id: { not: id } } })) throw new ApiError(409, "An identical rig already exists in the draft library.");
    await tx.toneDraft.update({ where: { id }, data: { ...input, rig: input.rig as Prisma.InputJsonValue, status: "DRAFT", reviewedAt: null, reviewedById: null, scheduledFor: null, error: null } });
    await event(tx, draft, "edited", "MANUAL", actor.id);
  });
}

export async function reviewDraft(actor: Actor, id: string, approve: boolean) {
  return adminTx(actor, async tx => {
    const draft = await findDraft(tx, id);
    if (draft.status === "PUBLISHED" || draft.removedAt) throw new ApiError(409, "This draft cannot be reviewed.");
    if (approve) await validateDraftReferences(tx, draftInput(draft));
    await tx.toneDraft.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: actor.id, reviewedAt: approve ? new Date() : null, scheduledFor: null, error: null } });
    await event(tx, draft, approve ? "approved" : "rejected", "MANUAL", actor.id);
  });
}

export async function scheduleDraft(actor: Actor, id: string, value: unknown) {
  if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new ApiError(400, "Use an ISO date with a time zone.");
  const when = new Date(value);
  if (!Number.isFinite(when.getTime()) || when <= new Date()) throw new ApiError(400, "Schedule a future time.");
  return adminTx(actor, async tx => {
    const draft = await findDraft(tx, id);
    if (!draft.reviewedAt || !["APPROVED", "SCHEDULED", "FAILED"].includes(draft.status) || draft.removedAt) throw new ApiError(409, "Approve this draft before scheduling.");
    await validateDraftReferences(tx, draftInput(draft));
    await tx.toneDraft.update({ where: { id }, data: { status: "SCHEDULED", scheduledFor: when, error: null } });
    await event(tx, draft, "scheduled", "MANUAL", actor.id);
  });
}

async function publish(tx: Tx, draft: ToneDraft, source: Source, actorId: string | null, now: Date) {
  if (draft.status === "PUBLISHED" && draft.toneId) return draft.toneId;
  if (!draft.reviewedAt || !["APPROVED", "SCHEDULED", "FAILED"].includes(draft.status) || draft.removedAt) throw new ApiError(409, "Approve this draft before publishing.");
  const input = draftInput(draft);
  const { creator, gearIds } = await validateDraftReferences(tx, input);
  if (draft.fingerprint !== input.fingerprint) throw new ApiError(409, "The draft changed after review.");
  const legacy = await tx.tone.findMany({ where: { origin: "GENERATED", user: { kind: "SYSTEM" }, draft: { is: null } }, select: { id: true, rig: true } });
  for (const tone of legacy) {
    let rig;
    try { rig = parseRig(tone.rig); } catch { continue; }
    if (rig && rigFingerprint(rig) === input.fingerprint) throw new ApiError(409, `A generated tone with these settings already exists (${tone.id}). Review it before importing; no existing content was changed.`);
  }
  const toneData = { userId: creator.userId, name: input.name, description: `${input.description}\n\n${GENERATED_DISCLOSURE}`, rig: input.rig as Prisma.InputJsonValue, visibility: "PUBLIC" as const, origin: "GENERATED" as const, anonymous: false, publishedAt: now };
  const tone = draft.toneId
    ? await tx.tone.update({ where: { id: draft.toneId }, data: toneData })
    : await tx.tone.create({ data: toneData });
  await tx.toneGear.deleteMany({ where: { toneId: tone.id } });
  if (gearIds.length) await tx.toneGear.createMany({ data: gearIds.map(gearItemId => ({ toneId: tone.id, gearItemId })) });
  let postId = draft.postId;
  if (input.communityId) {
    const postData = { authorId: creator.userId, communityId: input.communityId, toneId: tone.id, title: input.name, body: `${input.description}\n\nSuggested approach: ${input.rig.notes ?? "Start with the suggested settings, then adjust to your instrument and volume."}\n\n${GENERATED_DISCLOSURE}\n\nPublished by a Resoniq-managed demo creator. Share your own adjustments or a real recording if you try this starting point.`, status: "PUBLISHED" as const, category: "TUTORIAL" as const, removedReason: null };
    const existing = postId ? await tx.post.findUnique({ where: { id: postId } }) : null;
    const post = existing
      ? await tx.post.update({ where: { id: existing.id }, data: postData })
      : await tx.post.create({ data: { ...postData, hotRank: hotRank(0, now), createdAt: now } });
    postId = post.id;
    if (!existing || existing.status !== "PUBLISHED") await tx.community.update({ where: { id: input.communityId }, data: { postCount: { increment: 1 } } });
  }
  const updated = await tx.toneDraft.update({ where: { id: draft.id }, data: { status: "PUBLISHED", toneId: tone.id, postId, publishedAt: now, error: null } });
  await event(tx, updated, "published", source, actorId, undefined, now);
  return tone.id;
}

/** Roll back content first, then durably record the attempt without exposing internal errors. */
async function failed(id: string, source: Source, actorId: string | null, error: unknown, expectedUpdatedAt: Date) {
  const message = error instanceof ApiError ? error.message : "Publishing failed. Check server logs and retry after resolving the cause.";
  if (!(error instanceof ApiError)) console.error("[tone-publishing]", error);
  await prisma.$transaction(async tx => {
    await lock(tx);
    const draft = await findDraft(tx, id);
    // A racing successful publication or admin edit must never be overwritten by an old failure.
    if (!["APPROVED", "SCHEDULED", "FAILED"].includes(draft.status) || draft.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return;
    await tx.toneDraft.update({ where: { id }, data: { status: "FAILED", error: message } });
    await event(tx, draft, "failed", source, actorId, message);
  });
}

export async function publishDraft(actor: Actor, id: string) {
  // Permission failures are never allowed to write a failure record.
  await adminTx(actor, async () => undefined);
  let attempted: ToneDraft | null = null;
  try {
    return await adminTx(actor, async tx => {
      const draft = await findDraft(tx, id);
      attempted = draft;
      return publish(tx, draft, "MANUAL", actor.id, new Date());
    });
  } catch (error) {
    if (attempted && !(error instanceof ApiError && [403, 404, 409].includes(error.status))) await failed(id, "MANUAL", actor.id, error, (attempted as ToneDraft).updatedAt);
    throw error;
  }
}

export async function setPublishingPaused(actor: Actor, paused: unknown) {
  if (typeof paused !== "boolean") throw new ApiError(400, "paused must be a boolean.");
  return adminTx(actor, async tx => {
    await control(tx);
    await tx.tonePublishingControl.update({ where: { id: "default" }, data: { paused } });
    await recordAudit(tx, { actorId: actor.id, action: "tone.publishing.pause", targetType: "TonePublishingControl", targetId: "default", meta: { paused } });
  });
}

export async function unpublishDraft(actor: Actor, id: string, remove = false) {
  return adminTx(actor, async tx => {
    const draft = await findDraft(tx, id);
    if (!draft.toneId || draft.removedAt) return;
    if (draft.postId) {
      const post = await tx.post.findUnique({ where: { id: draft.postId } });
      if (post) {
        await tx.post.update({ where: { id: post.id }, data: { status: "REMOVED", removedReason: "Resoniq demo preset withdrawn." } });
        if (post.status === "PUBLISHED" && post.communityId) await tx.community.update({ where: { id: post.communityId }, data: { postCount: { decrement: 1 } } });
      }
    }
    if (remove) await tx.tone.delete({ where: { id: draft.toneId } });
    else await tx.tone.update({ where: { id: draft.toneId }, data: { visibility: "PRIVATE" } });
    await tx.toneDraft.update({ where: { id }, data: { status: "UNPUBLISHED", scheduledFor: null, ...(remove && { removedAt: new Date() }) } });
    await event(tx, draft, remove ? "removed" : "unpublished", "MANUAL", actor.id);
  });
}

/** One explicit, atomic initial batch. It never increases the daily automation budget. */
export async function importInitialTones(actor: Actor, confirmation: unknown) {
  if (confirmation !== INITIAL_IMPORT_CONFIRMATION) throw new ApiError(400, "Confirm the reviewed 26-tone initial import.");
  let attempted: ToneDraft | null = null;
  try { return await adminTx(actor, async tx => {
    const settings = await control(tx);
    const drafts = await tx.toneDraft.findMany({ where: { key: { in: INITIAL_PRESET_KEYS } } });
    if (settings.initialImportAt) return { imported: 0, toneIds: drafts.flatMap(d => d.toneId ? [d.toneId] : []) };
    if (drafts.length !== 26 || drafts.some(d => !d.reviewedAt || !["APPROVED", "PUBLISHED"].includes(d.status))) throw new ApiError(409, "All 26 initial presets must be individually reviewed and approved first.");
    const toneIds: string[] = [];
    const now = new Date();
    for (const draft of drafts) {
      attempted = draft;
      toneIds.push(await publish(tx, draft, "IMPORT", actor.id, now));
    }
    await tx.tonePublishingControl.update({ where: { id: "default" }, data: { initialImportAt: now } });
    await recordAudit(tx, { actorId: actor.id, action: "tone.publishing.initial_import", targetType: "TonePublishingControl", targetId: "default", meta: { count: toneIds.length, keys: INITIAL_PRESET_KEYS } });
    return { imported: toneIds.length, toneIds };
  }); } catch (error) {
    if (attempted && !(error instanceof ApiError && [403, 404].includes(error.status))) {
      const draft = attempted as ToneDraft;
      await failed(draft.id, "IMPORT", actor.id, error, draft.updatedAt);
    }
    throw error;
  }
}

/** Invoked only by the authenticated daily cron; no persistent worker required. */
export async function publishScheduledTones(now = new Date()) {
  let published = 0;
  let failures = 0;
  const failedIds: string[] = [];
  // At most two attempts per invocation; repeat cron calls still share the same durable daily budget.
  for (let attempt = 0; attempt < 2; attempt++) {
    let attempted: ToneDraft | null = null;
    try {
      const result = await prisma.$transaction(async tx => {
        await lock(tx);
        if ((await control(tx)).paused) return false;
        const day = new Date(now); day.setUTCHours(0, 0, 0, 0);
        const end = new Date(day.getTime() + 86_400_000);
        if (await tx.tonePublishingEvent.count({ where: { source: "AUTO", action: "published", createdAt: { gte: day, lt: end } } }) >= 2) return false;
        const draft = await tx.toneDraft.findFirst({ where: { id: { notIn: failedIds }, status: { in: ["SCHEDULED", "FAILED"] }, reviewedAt: { not: null }, scheduledFor: { lte: now }, removedAt: null, creator: { enabled: true } }, orderBy: [{ scheduledFor: "asc" }, { id: "asc" }] });
        if (!draft) return false;
        attempted = draft;
        await publish(tx, draft, "AUTO", null, now);
        return true;
      }, { maxWait: 10_000, timeout: 20_000 });
      if (!result) break;
      published++;
    } catch (error) {
      if (!attempted) throw error;
      const draft = attempted as ToneDraft;
      await failed(draft.id, "AUTO", null, error, draft.updatedAt);
      failedIds.push(draft.id);
      failures++;
    }
  }
  return { published, failures };
}

function batchIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_BATCH || ids.some(id => typeof id !== "string" || !id || id.length > 40)) throw new ApiError(400, `Choose 1–${MAX_BATCH} drafts.`);
  return [...new Set(ids as string[])];
}

/** Bulk review: one transaction, each draft validated exactly as a single approval would be. */
export async function reviewDrafts(actor: Actor, ids: unknown, approve: boolean) {
  const list = batchIds(ids);
  return adminTx(actor, async tx => {
    let changed = 0;
    for (const id of list) {
      const draft = await findDraft(tx, id);
      if (draft.status === "PUBLISHED" || draft.removedAt || (approve && draft.status === "APPROVED")) continue;
      if (approve) await validateDraftReferences(tx, draftInput(draft));
      await tx.toneDraft.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: actor.id, reviewedAt: approve ? new Date() : null, scheduledFor: null, error: null } });
      await event(tx, draft, approve ? "approved" : "rejected", "MANUAL", actor.id);
      changed++;
    }
    return { changed };
  });
}

/** Queues approved drafts for the daily run, which still publishes at most two per UTC day. */
export async function scheduleDrafts(actor: Actor, ids: unknown, value: unknown) {
  const list = batchIds(ids);
  if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new ApiError(400, "Use an ISO date with a time zone.");
  const when = new Date(value);
  if (!Number.isFinite(when.getTime()) || when <= new Date()) throw new ApiError(400, "Schedule a future time.");
  return adminTx(actor, async tx => {
    let changed = 0;
    for (const id of list) {
      const draft = await findDraft(tx, id);
      if (!draft.reviewedAt || draft.status !== "APPROVED" || draft.removedAt) continue;
      await tx.toneDraft.update({ where: { id }, data: { status: "SCHEDULED", scheduledFor: when, error: null } });
      await event(tx, draft, "scheduled", "MANUAL", actor.id);
      changed++;
    }
    return { changed };
  });
}

/**
 * An explicit, confirmed batch release outside the daily automation budget.
 * All or nothing; already-published drafts are skipped, so repeating it is a no-op.
 */
export async function publishBatch(actor: Actor, ids: unknown, confirmation: unknown) {
  const list = batchIds(ids);
  if (confirmation !== batchConfirmation(list.length)) throw new ApiError(400, `Confirm with “${batchConfirmation(list.length)}”.`);
  let attempted: ToneDraft | null = null;
  try {
    return await adminTx(actor, async tx => {
      const drafts = await tx.toneDraft.findMany({ where: { id: { in: list } }, orderBy: { key: "asc" } });
      if (drafts.length !== list.length) throw new ApiError(404, "Draft not found.");
      const pending = drafts.filter(d => d.status !== "PUBLISHED");
      if (pending.some(d => !d.reviewedAt || !["APPROVED", "SCHEDULED", "FAILED"].includes(d.status) || d.removedAt)) throw new ApiError(409, "Every draft in a batch must be reviewed and approved first.");
      const now = new Date();
      const toneIds: string[] = [];
      for (const draft of pending) {
        attempted = draft;
        toneIds.push(await publish(tx, draft, "IMPORT", actor.id, now));
      }
      await recordAudit(tx, { actorId: actor.id, action: "tone.publishing.batch", targetType: "TonePublishingControl", targetId: "default", meta: { count: toneIds.length, keys: pending.map(d => d.key) } });
      return { published: toneIds.length, skipped: drafts.length - pending.length, toneIds };
    });
  } catch (error) {
    if (attempted && !(error instanceof ApiError && [403, 404].includes(error.status))) {
      const draft = attempted as ToneDraft;
      await failed(draft.id, "IMPORT", actor.id, error, draft.updatedAt);
    }
    throw error;
  }
}

export async function editManagedCreator(actor: Actor, id: string, body: Record<string, unknown>) {
  if (typeof body.enabled !== "boolean" || typeof body.specialization !== "string" || !body.specialization.trim() || body.specialization.length > 120) throw new ApiError(400, "Set an enabled state and specialization (1–120 characters).");
  const enabled = body.enabled;
  const specialization = body.specialization.trim();
  return adminTx(actor, async tx => {
    const creator = await tx.managedCreator.findUnique({ where: { id }, include: { user: true } });
    if (!creator || creator.owner !== "Resoniq" || creator.user.kind !== "SYSTEM") throw new ApiError(404, "Managed creator not found.");
    await tx.managedCreator.update({ where: { id }, data: { enabled, specialization } });
    await recordAudit(tx, { actorId: actor.id, action: "tone.creator.updated", targetType: "ManagedCreator", targetId: id, meta: { enabled, specialization } });
  });
}
