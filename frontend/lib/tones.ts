import { tankGSheet } from "@/lib/devices/tank-g";
import type { Prisma, ToneVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "@/lib/authz";
import { notify } from "@/lib/notify";
import { page, type Cursor } from "@/lib/pagination";
import { AUTHOR_SELECT, type Author } from "@/lib/profiles";
import { parseRig, rigGearIds } from "@/lib/rig-validation";
import { recipeCoreFromStored, studioPatchFromStored } from "@/lib/tone-recipe";
import type { StudioPatch } from "@/lib/studio/patch";
import { TANK_G_SLUG, validateTankGRig } from "@/lib/devices/tank-g";
import { parseStoredToneData, parseToneName } from "@/lib/tone-validation";
import { fail } from "@/lib/validation";
import { ANONYMOUS_AUTHOR } from "@/lib/system-identity";
import type { RigSpec } from "@/types/rig";
import type { RecipeCore } from "@/types/tone";

export const TONE_VISIBILITIES: ToneVisibility[] = ["PRIVATE", "UNLISTED", "PUBLIC"];

/** Shown with every Resoniq-generated tone (tone page, export, admin preview). */
export const GENERATED_DISCLOSURE =
  "Resoniq-generated: suggested starting settings written by Resoniq. Not taken from a recording, and not tested on the listed gear.";
export const MAX_TONE_DESCRIPTION = 4000;

const TONE_SELECT = {
  id: true,
  userId: true,
  songId: true,
  name: true,
  description: true,
  visibility: true,
  data: true,
  rig: true,
  recipeEdited: true,
  saveCount: true,
  remixCount: true,
  favorite: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  origin: true,
  anonymous: true,
  user: { select: { ...AUTHOR_SELECT, status: true } },
  remixOf: { select: { id: true, name: true, visibility: true, anonymous: true, user: { select: { ...AUTHOR_SELECT, status: true } } } },
} satisfies Prisma.ToneSelect;

type ToneRow = Prisma.ToneGetPayload<{ select: typeof TONE_SELECT }>;

/**
 * A tone as anyone may see it. `inferred` is Resoniq's analysis (possibly
 * adjusted by the creator); `declared` is the creator's own rig. They are
 * kept apart all the way to the UI.
 */
export type ToneView = {
  id: string;
  name: string;
  description: string | null;
  visibility: ToneVisibility;
  /** Who's shown: the owner, or ANONYMOUS_AUTHOR (no profile link) when `anonymous`. */
  author: Author;
  anonymous: boolean;
  /** "generated": suggested settings written by Resoniq, not a member's rig or an analysis. */
  origin: "member" | "generated";
  inferred: RecipeCore | null;
  /** Settings built in the Amp Studio (never labelled as analysis). */
  studio: StudioPatch | null;
  recipeEdited: boolean;
  declared: RigSpec | null;
  saveCount: number;
  remixCount: number;
  remixOf: { id: string; name: string; author: Author; anonymous: boolean } | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  viewer: { isOwner: boolean; saved: boolean; favorite: boolean };
  /** Owner only: the analyzed song this came from (audio stays private to the owner). */
  songId: string | null;
};

const stripStatus = ({ status: _s, ...a }: Author & { status: string }): Author => a;

export function toToneView(t: ToneRow, viewerId: string | null, saved = false): ToneView {
  const isOwner = viewerId === t.userId;
  const source = t.remixOf && t.remixOf.visibility !== "PRIVATE" && t.remixOf.user.status !== "BANNED" ? t.remixOf : null;
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    visibility: t.visibility,
    author: t.anonymous ? ANONYMOUS_AUTHOR : stripStatus(t.user),
    anonymous: t.anonymous,
    origin: t.origin === "GENERATED" ? "generated" : "member",
    inferred: recipeCoreFromStored(t.data),
    studio: studioPatchFromStored(t.data),
    recipeEdited: t.recipeEdited,
    declared: (t.rig as RigSpec | null) ?? null,
    saveCount: t.saveCount,
    remixCount: t.remixCount,
    remixOf: source && { id: source.id, name: source.name, author: source.anonymous ? ANONYMOUS_AUTHOR : stripStatus(source.user), anonymous: source.anonymous },
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    publishedAt: t.publishedAt?.toISOString() ?? null,
    viewer: { isOwner, saved, favorite: isOwner && t.favorite },
    songId: isOwner ? t.songId : null,
  };
}

/** Rows for building ToneViews by id (callers have already applied visibility). */
export const getToneRows = (ids: string[]) => prisma.tone.findMany({ where: { id: { in: ids } }, select: TONE_SELECT });

/** Direct access: public and unlisted tones by anyone, private ones by their owner; never a banned owner's. */
export function viewableToneWhere(viewerId: string | null): Prisma.ToneWhereInput {
  return {
    user: { status: { not: "BANNED" } },
    OR: [{ visibility: { in: ["PUBLIC", "UNLISTED"] } }, ...(viewerId ? [{ userId: viewerId }] : [])],
  };
}

/** Listings (discovery, profiles, gear pages): public only. */
export const listedToneWhere: Prisma.ToneWhereInput = { visibility: "PUBLIC", user: { status: { not: "BANNED" } } };

export async function getTone(id: string, viewerId: string | null): Promise<ToneView | null> {
  const t = await prisma.tone.findFirst({ where: { AND: [{ id }, viewableToneWhere(viewerId)] }, select: TONE_SELECT });
  if (!t) return null;
  const saved = viewerId ? !!(await prisma.toneSave.findUnique({ where: { userId_toneId: { userId: viewerId, toneId: id } } })) : false;
  return toToneView(t, viewerId, saved);
}

async function withSaved(rows: ToneRow[], viewerId: string | null) {
  if (!viewerId || !rows.length) return rows.map((r) => toToneView(r, viewerId));
  const saved = new Set((await prisma.toneSave.findMany({ where: { userId: viewerId, toneId: { in: rows.map((r) => r.id) } }, select: { toneId: true } })).map((s) => s.toneId));
  return rows.map((r) => toToneView(r, viewerId, saved.has(r.id)));
}

// ── Input ──────────────────────────────────────────────────────────────

export type ToneInput = {
  name?: string;
  data?: ReturnType<typeof parseStoredToneData> | null;
  rig?: RigSpec | null;
  description?: string | null;
  visibility?: ToneVisibility;
  favorite?: boolean;
};

export function parseToneInput(body: Record<string, unknown>, { partial }: { partial: boolean }): ToneInput {
  const out: ToneInput = {};
  if (body.name !== undefined || !partial) out.name = parseToneName(body.name);
  if (body.data !== undefined) out.data = body.data === null ? null : parseStoredToneData(body.data);
  if (body.rig !== undefined) out.rig = parseRig(body.rig);
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") fail("description must be text.");
    const d = typeof body.description === "string" ? body.description.trim() : "";
    if (d.length > MAX_TONE_DESCRIPTION) fail(`Descriptions are at most ${MAX_TONE_DESCRIPTION} characters.`);
    out.description = d || null;
  }
  if (body.visibility !== undefined) {
    if (!TONE_VISIBILITIES.includes(body.visibility as ToneVisibility)) fail("visibility must be PRIVATE, UNLISTED or PUBLIC.");
    out.visibility = body.visibility as ToneVisibility;
  }
  if (body.favorite !== undefined) {
    if (typeof body.favorite !== "boolean") fail("favorite must be a boolean.");
    out.favorite = body.favorite;
  }
  return out;
}

type Db = Prisma.TransactionClient;

/** Catalog gear a rig references must exist (approved, or the owner's own pending submission). */
/** A rig that claims to be a hardware preset must be one the hardware can actually hold. */
async function assertDevice(tx: Db, rig: RigSpec | null | undefined) {
  if (rig?.device?.slug !== TANK_G_SLUG) return;
  const device = await tx.gearItem.findFirst({ where: { slug: TANK_G_SLUG }, select: { id: true } });
  if (!device) throw new ApiError(400, "That device isn't in the catalog.");
  validateTankGRig(rig, device.id);
}

async function assertGear(tx: Db, rig: RigSpec | null | undefined, userId: string) {
  await assertDevice(tx, rig);
  const ids = rigGearIds(rig ?? null);
  if (!ids.length) return ids;
  const found = await tx.gearItem.count({ where: { id: { in: ids }, OR: [{ status: "APPROVED" }, { createdById: userId }] } });
  if (found !== ids.length) throw new ApiError(400, "The rig references gear that isn't in the catalog.");
  return ids;
}

async function syncToneGear(tx: Db, toneId: string, gearIds: string[]) {
  await tx.toneGear.deleteMany({ where: { toneId } });
  if (gearIds.length) await tx.toneGear.createMany({ data: gearIds.map((gearItemId) => ({ toneId, gearItemId })) });
}

const json = (v: unknown) => (v === null ? (null as unknown as Prisma.InputJsonValue) : (v as Prisma.InputJsonValue));

export async function createTone(actor: Actor, input: ToneInput & { songId?: string | null; remixOfId?: string; recipeEdited?: boolean }) {
  if (!input.data && !input.rig) throw new ApiError(400, "A tone needs an analysis recipe or a rig.");
  return prisma.$transaction(async (tx) => {
    const gearIds = await assertGear(tx, input.rig, actor.id);
    const visibility = input.visibility ?? "UNLISTED";
    const tone = await tx.tone.create({
      data: {
        userId: actor.id,
        name: input.name!,
        songId: input.songId ?? null,
        data: input.data ? json(input.data) : undefined,
        rig: input.rig ? json(input.rig) : undefined,
        description: input.description ?? null,
        visibility,
        publishedAt: visibility === "PUBLIC" ? new Date() : null,
        remixOfId: input.remixOfId,
        recipeEdited: input.recipeEdited ?? false,
        favorite: input.favorite ?? false,
      },
      select: { id: true },
    });
    await syncToneGear(tx, tone.id, gearIds);
    return tone.id;
  });
}

export async function updateTone(actor: Actor, id: string, input: ToneInput) {
  await prisma.$transaction(async (tx) => {
    const tone = await tx.tone.findFirst({ where: { id, userId: actor.id }, select: { id: true, publishedAt: true, data: true } });
    if (!tone) throw new ApiError(404, "Tone not found.");
    const data: Prisma.ToneUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.favorite !== undefined) data.favorite = input.favorite;
    if (input.description !== undefined) data.description = input.description;
    if (input.data !== undefined) {
      // The recipe and the studio patch are updated independently: sending one never drops the other.
      const merged = input.data && {
        version: 2 as const,
        ...((input.data.recipe ?? recipeCoreFromStored(tone.data)) && { recipe: input.data.recipe ?? recipeCoreFromStored(tone.data)! }),
        ...((input.data.studio ?? studioPatchFromStored(tone.data)) && { studio: input.data.studio ?? studioPatchFromStored(tone.data)! }),
      };
      data.data = merged === null ? (null as unknown as Prisma.InputJsonValue) : json(merged);
      // An analysis recipe the creator retunes is labelled as adjusted, not as raw analysis.
      // Only the recipe counts: adding or changing a studio patch leaves the analysis as it was.
      const before = recipeCoreFromStored(tone.data);
      if (input.data?.recipe && before && JSON.stringify(input.data.recipe) !== JSON.stringify(before)) data.recipeEdited = true;
    }
    if (input.rig !== undefined) {
      data.rig = input.rig === null ? (null as unknown as Prisma.InputJsonValue) : json(input.rig);
      await syncToneGear(tx, id, await assertGear(tx, input.rig, actor.id));
    }
    if (input.visibility !== undefined) {
      data.visibility = input.visibility;
      if (input.visibility === "PUBLIC" && !tone.publishedAt) data.publishedAt = new Date();
    }
    await tx.tone.update({ where: { id }, data });
  });
  return (await getTone(id, actor.id))!;
}

// ── Social actions ────────────────────────────────────────────────────

export async function setToneSaved(actor: Actor, toneId: string, on: boolean) {
  const created = await prisma.$transaction(async (tx) => {
    const tone = await tx.tone.findFirst({ where: { AND: [{ id: toneId }, viewableToneWhere(actor.id)] }, select: { id: true, userId: true, user: { select: { kind: true } } } });
    if (!tone) throw new ApiError(404, "Tone not found.");
    const { count } = on
      ? await tx.toneSave.createMany({ data: [{ userId: actor.id, toneId }], skipDuplicates: true })
      : await tx.toneSave.deleteMany({ where: { userId: actor.id, toneId } });
    if (count) await tx.tone.update({ where: { id: toneId }, data: { saveCount: { increment: on ? 1 : -1 } } });
    // System identities have no inbox.
    return on && count && tone.user.kind === "PERSON" ? tone.userId : null;
  });
  if (created) await notify({ userId: created, type: "TONE_SAVE", actorId: actor.id, toneId });
  return { saved: on };
}

/** Copies a tone into the actor's library, crediting the source. The copy starts unlisted. */
export async function remixTone(actor: Actor, sourceId: string): Promise<string> {
  const source = await prisma.tone.findFirst({
    where: { AND: [{ id: sourceId }, viewableToneWhere(actor.id)] },
    select: { id: true, userId: true, name: true, data: true, rig: true, description: true, origin: true, user: { select: { kind: true } } },
  });
  if (!source) throw new ApiError(404, "Tone not found.");
  const name = `${source.name} (remix)`.slice(0, 120);
  const id = await prisma.$transaction(async (tx) => {
    const tone = await tx.tone.create({
      data: {
        userId: actor.id,
        name,
        data: source.data ?? undefined,
        rig: source.rig ?? undefined,
        description: source.description,
        visibility: "UNLISTED",
        remixOfId: source.id,
        origin: source.origin,
      },
      select: { id: true },
    });
    await syncToneGear(tx, tone.id, rigGearIds((source.rig as RigSpec | null) ?? null));
    await tx.tone.update({ where: { id: source.id }, data: { remixCount: { increment: 1 } } });
    return tone.id;
  });
  if (source.user.kind === "PERSON") await notify({ userId: source.userId, type: "TONE_REMIX", actorId: actor.id, toneId: id });
  return id;
}

// ── Listings ──────────────────────────────────────────────────────────

export type ToneListQuery = {
  sort: "new" | "popular";
  instrument?: "GUITAR" | "BASS";
  gearId?: string;
  authorId?: string;
  q?: string;
  /** "members" hides Resoniq-generated presets; "generated" shows only them. */
  source?: "members" | "generated";
  /** A genre named in the rig's references, matched case-insensitively against TONE_GENRES. */
  genre?: string;
  /** Device metadata (lib/devices): amp slot, collection, and an effect type used in the chain. */
  ampSlot?: number;
  collection?: string;
  effect?: string;
  cursor: Cursor | null;
  limit: number;
};

/** Genres tones can be filtered by: the genre communities, lowercased as stored in rig.references.genres. */
export const TONE_GENRES = ["blues", "rock", "metal", "jazz", "funk", "indie", "ambient", "worship", "country", "prog", "pop", "shoegaze"] as const;

export function parseToneSource(v: string | null | undefined): ToneListQuery["source"] {
  return v === "members" || v === "generated" ? v : undefined;
}
export function parseToneGenre(v: string | null | undefined): string | undefined {
  const g = v?.toLowerCase();
  return g && (TONE_GENRES as readonly string[]).includes(g) ? g : undefined;
}

export async function listTones(viewerId: string | null, q: ToneListQuery, base: Prisma.ToneWhereInput = listedToneWhere) {
  const and: Prisma.ToneWhereInput[] = [base];
  // Anonymous tones never appear on their owner's profile listing.
  if (q.authorId) and.push({ userId: q.authorId, anonymous: false });
  if (q.source) and.push({ origin: q.source === "generated" ? "GENERATED" : "MEMBER" });
  if (q.genre) and.push({ rig: { path: ["references", "genres"], array_contains: [q.genre] } });
  if (q.gearId) and.push({ gear: { some: { gearItemId: q.gearId } } });
  if (q.ampSlot) and.push({ rig: { path: ["device", "ampSlot"], equals: q.ampSlot } });
  if (q.collection) and.push({ rig: { path: ["device", "collection"], equals: q.collection } });
  if (q.effect) and.push({ rig: { path: ["chain"], array_contains: [{ enabled: true, params: { Type: q.effect } }] } });
  if (q.instrument) and.push({ rig: { path: ["instrument", "kind"], equals: q.instrument } });
  if (q.q) and.push({ OR: [{ name: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }] });
  const field = q.sort === "popular" ? "saveCount" : "createdAt";
  if (q.cursor) {
    const v = field === "saveCount" ? Number(q.cursor.t) : new Date(q.cursor.t);
    and.push({ OR: [{ [field]: { lt: v } }, { [field]: v, id: { lt: q.cursor.id } }] });
  }
  const rows = await prisma.tone.findMany({ where: { AND: and }, orderBy: [{ [field]: "desc" }, { id: "desc" }], take: q.limit + 1, select: TONE_SELECT });
  const { items, nextCursor } = page(rows, q.limit, (r) => ({ t: field === "saveCount" ? String(r.saveCount) : r.createdAt.toISOString(), id: r.id }));
  return { items: await withSaved(items, viewerId), nextCursor };
}

/** The viewer's own and saved tones that use a catalog item (e.g. the TANK-G bank planner). */
export async function deviceTones(viewerId: string, gearId: string, limit = 60) {
  const rows = await prisma.tone.findMany({
    where: { AND: [viewableToneWhere(viewerId), { gear: { some: { gearItemId: gearId } } }, { OR: [{ userId: viewerId }, { saves: { some: { userId: viewerId } } }] }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: TONE_SELECT,
  });
  return rows.map((r) => toToneView(r, viewerId));
}

export async function savedTones(viewerId: string, cursor: Cursor | null, limit: number) {
  const rows = await prisma.toneSave.findMany({
    where: {
      userId: viewerId,
      tone: viewableToneWhere(viewerId),
      ...(cursor && { OR: [{ createdAt: { lt: new Date(cursor.t) } }, { createdAt: new Date(cursor.t), toneId: { lt: cursor.id } }] }),
    },
    orderBy: [{ createdAt: "desc" }, { toneId: "desc" }],
    take: limit + 1,
    select: { createdAt: true, toneId: true, tone: { select: TONE_SELECT } },
  });
  const { items, nextCursor } = page(rows, limit, (r) => ({ t: r.createdAt.toISOString(), id: r.toneId }));
  return { items: items.map((r) => toToneView(r.tone, viewerId, true)), nextCursor };
}

// ── Export ────────────────────────────────────────────────────────────

/** Resoniq's own interchange format. Not a modeler preset: no proprietary formats are written. */
export function exportTone(t: ToneView, origin: string) {
  return {
    format: "resoniq-tone",
    version: 1,
    exportedAt: new Date().toISOString(),
    url: `${origin}/t/${t.id}`,
    name: t.name,
    description: t.description,
    author: t.anonymous ? t.author.name : `@${t.author.handle}`,
    remixOf: t.remixOf && { url: `${origin}/t/${t.remixOf.id}`, name: t.remixOf.name, author: t.remixOf.anonymous ? t.remixOf.author.name : `@${t.remixOf.author.handle}` },
    ...(t.origin === "generated" && { provenance: GENERATED_DISCLOSURE }),
    declared: t.declared,
    ...(t.declared && tankGSheet(t.declared).length && {
      device: { name: "M-VAVE TANK-G", note: "Resoniq JSON for reading or re-importing into Resoniq; not a native M-EFCS preset file. Knob values are normalized 0–10 positions.", panel: tankGSheet(t.declared) },
    }),
    inferred: t.inferred && {
      ...t.inferred,
      note: t.recipeEdited
        ? "Inferred by Resoniq's audio analysis, then adjusted by the creator. Heuristic, not a verified rig."
        : "Inferred by Resoniq's audio analysis. Heuristic, not a verified rig.",
    },
  };
}
