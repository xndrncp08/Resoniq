import type { StoredToneData } from "@/lib/tone-recipe";
import type { AmpSettings, PedalSlot, PickupPosition, RecipeCore } from "@/types/tone";

/**
 * Validates tone payloads from the client before they are stored. Whatever
 * passes here is later rendered on the public /t/[id] page, so every field
 * is type-checked, strings are length-capped and knobs are clamped.
 */

export const MAX_TONE_NAME_LENGTH = 120;
const MAX_TEXT = 200;
const MAX_DESCRIPTION = 2000;
const MAX_PEDALS = 12;
const MAX_ARTISTS = 8;
const PICKUPS: PickupPosition[] = ["Bridge", "Middle", "Neck", "Bridge/Middle", "Neck/Middle"];
const PEDAL_TYPES = ["dynamics", "drive", "modulation", "time"];

export class ValidationError extends Error {}

function fail(message: string): never {
  throw new ValidationError(message);
}

function obj(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${field} must be an object.`);
  return v as Record<string, unknown>;
}

function text(v: unknown, field: string, max = MAX_TEXT): string {
  if (typeof v !== "string") fail(`${field} must be a string.`);
  const s = v.trim();
  if (!s) fail(`${field} is required.`);
  if (s.length > max) fail(`${field} is too long.`);
  return s;
}

function knob(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${field} must be a number.`);
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function parseToneName(v: unknown): string {
  return text(v, "name", MAX_TONE_NAME_LENGTH);
}

function parseAmp(v: unknown): AmpSettings {
  const a = obj(v, "amp");
  return {
    family: text(a.family, "amp.family"),
    model: text(a.model, "amp.model"),
    gain: knob(a.gain, "amp.gain"),
    bass: knob(a.bass, "amp.bass"),
    mids: knob(a.mids, "amp.mids"),
    treble: knob(a.treble, "amp.treble"),
    presence: knob(a.presence, "amp.presence"),
  };
}

function parsePedal(v: unknown, i: number): PedalSlot {
  const p = obj(v, `pedalboard[${i}]`);
  const type = text(p.type, `pedalboard[${i}].type`);
  if (!PEDAL_TYPES.includes(type)) fail(`pedalboard[${i}].type is not a known pedal type.`);
  if (typeof p.enabled !== "boolean") fail(`pedalboard[${i}].enabled must be a boolean.`);
  const pedal: PedalSlot = { slot: i + 1, name: text(p.name, `pedalboard[${i}].name`), type, enabled: p.enabled };
  for (const k of ["drive", "tone", "level"] as const) {
    if (p[k] !== undefined) pedal[k] = knob(p[k], `pedalboard[${i}].${k}`);
  }
  return pedal;
}

export function parseRecipeCore(v: unknown): RecipeCore {
  const r = obj(v, "recipe");
  if (!Array.isArray(r.pedalboard) || r.pedalboard.length > MAX_PEDALS) {
    fail(`pedalboard must be a list of at most ${MAX_PEDALS} pedals.`);
  }
  if (!Array.isArray(r.similarArtists) || r.similarArtists.length > MAX_ARTISTS) {
    fail(`similarArtists must be a list of at most ${MAX_ARTISTS} names.`);
  }
  if (!PICKUPS.includes(r.pickup as PickupPosition)) fail("pickup is not a known position.");
  const cabinet = obj(r.cabinet, "cabinet");
  return {
    confidenceScore: knob(r.confidenceScore, "confidenceScore"),
    recipeDescription: text(r.recipeDescription, "recipeDescription", MAX_DESCRIPTION),
    amp: parseAmp(r.amp),
    cabinet: { type: text(cabinet.type, "cabinet.type"), speaker: text(cabinet.speaker, "cabinet.speaker") },
    pickup: r.pickup as PickupPosition,
    pedalboard: r.pedalboard.map(parsePedal),
    similarArtists: r.similarArtists.map((a, i) => text(a, `similarArtists[${i}]`)),
  };
}

export function parseStoredToneData(v: unknown): StoredToneData {
  const d = obj(v, "data");
  if (d.version !== 2) fail("data.version must be 2.");
  return { version: 2, recipe: parseRecipeCore(d.recipe) };
}
