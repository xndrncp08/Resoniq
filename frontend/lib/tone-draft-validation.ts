import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { parseRig, rigGearIds } from "@/lib/rig-validation";
import { parseToneInput, TONE_GENRES } from "@/lib/tones";
import type { TonePreset, PresetGear } from "@/lib/tone-presets";
import type { GearRef, RigSpec } from "@/types/rig";

export type DraftInput = { name: string; description: string; instrument: string; genres: string[]; rig: RigSpec; creatorId: string; communityId: string | null; fingerprint: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function rigFingerprint(rig: RigSpec): string {
  return createHash("sha256").update(canonical({
    instrument: rig.instrument, amp: rig.amp, cab: rig.cab, eq: rig.eq ?? {},
    chain: rig.chain.map(({ id: _id, ...block }) => block),
  })).digest("hex");
}

export function parseDraftInput(body: Record<string, unknown>): DraftInput {
  const input = parseToneInput(body, { partial: false });
  const rig = parseRig(body.rig);
  if (!rig?.instrument || !rig.amp?.ref) throw new ApiError(400, "A preset needs an instrument and an amplifier.");
  const genres = rig.references?.genres ?? [];
  if (!genres.length || genres.some(g => !(TONE_GENRES as readonly string[]).includes(g))) throw new ApiError(400, "Choose valid tone genres.");
  if (!input.description || typeof body.creatorId !== "string" || !body.creatorId) throw new ApiError(400, "A description and managed creator are required.");
  if (input.description.length > 3800) throw new ApiError(400, "Draft descriptions are at most 3800 characters, leaving room for the provenance disclosure.");
  if (body.communityId !== null && body.communityId !== undefined && typeof body.communityId !== "string") throw new ApiError(400, "Invalid community.");
  return {
    name: input.name!, description: input.description, rig, instrument: rig.instrument.kind, genres,
    creatorId: body.creatorId, communityId: typeof body.communityId === "string" && body.communityId ? body.communityId : null,
    // Names and descriptions don't make an otherwise identical rig a new preset.
    fingerprint: rigFingerprint(rig),
  };
}

export async function validateDraftReferences(tx: Prisma.TransactionClient, input: DraftInput) {
  const creator = await tx.managedCreator.findFirst({ where: { id: input.creatorId, owner: "Resoniq", enabled: true, user: { kind: "SYSTEM", role: "USER", status: "ACTIVE", email: null, passwordHash: null } } });
  if (!creator) throw new ApiError(400, "Select an enabled Resoniq-managed creator.");
  if (input.communityId && !await tx.community.findFirst({ where: { id: input.communityId, archivedAt: null } })) throw new ApiError(400, "Select an active community.");
  const ids = rigGearIds(input.rig);
  const gear = await tx.gearItem.findMany({ where: { id: { in: ids }, status: "APPROVED" }, select: { id: true, model: true, brand: true } });
  if (gear.length !== ids.length) throw new ApiError(400, "The preset references missing or unapproved catalog gear.");
  const refs = [input.rig.instrument?.ref, input.rig.amp?.ref, input.rig.cab?.ref, ...input.rig.chain.map(b => b.ref)];
  for (const ref of refs) if (ref?.gearId) {
    const item = gear.find(g => g.id === ref.gearId)!;
    if (item.model !== ref.model || item.brand !== ref.brand) throw new ApiError(400, "Catalog gear names must match their references.");
  }
  return { creator, gearIds: ids };
}

export async function presetRig(tx: Prisma.TransactionClient, preset: TonePreset): Promise<RigSpec> {
  const gear = await tx.gearItem.findMany({ where: { status: "APPROVED" }, select: { id: true, slug: true, model: true, brand: true } });
  const ref = (g: PresetGear): GearRef => {
    if (!("slug" in g)) return g;
    const item = gear.find(item => item.slug === g.slug);
    if (!item) throw new ApiError(400, `Missing approved catalog gear: ${g.slug}.`);
    return { gearId: item.id, brand: item.brand, model: item.model };
  };
  return parseRig({
    instrument: { kind: preset.instrument, ref: ref(preset.player.gear), pickups: preset.player.pickups, pickupPosition: preset.player.pickupPosition, strings: preset.player.strings, tuning: preset.player.tuning },
    amp: { ref: ref(preset.amp.gear), channel: preset.amp.channel, settings: preset.amp.settings },
    cab: { ...(preset.cab.gear && { ref: ref(preset.cab.gear) }), speakers: preset.cab.speakers, mic: preset.cab.mic },
    chain: preset.chain.map((b, i) => ({ id: `b${i + 1}`, category: b.category, ...(b.gear && { ref: ref(b.gear) }), params: b.params, enabled: b.enabled !== false, placement: b.placement ?? "pre" })),
    eq: preset.eq, notes: preset.playing, setupGuide: preset.setup, alternatives: preset.alternatives,
    references: { genres: preset.genres, styles: preset.styles, artists: preset.artists },
  })!;
}
