import type { Prisma, ToneVersionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { recipeCoreFromStored, studioPatchFromStored } from "@/lib/tone-recipe";
import { patchFromTone } from "@/lib/studio/from-tone";
import { diffPatches } from "@/lib/tone-diff";
import { dnaFromPatch, type ToneDna } from "@/lib/tone-dna";
import type { StudioPatch } from "@/lib/studio/patch";
import type { RigSpec } from "@/types/rig";

/**
 * Tone Time Machine: every change to a tone's settings (data, rig or name)
 * leaves a snapshot. History is the owner's alone. Restoring never deletes
 * anything: it saves the old settings as a new version.
 */

export const MAX_VERSIONS = 60;
export const MAX_NOTE = 200;

type State = { name: string; data: Prisma.JsonValue | null; rig: Prisma.JsonValue | null };
export type ToneVersionView = { id: string; kind: ToneVersionKind; name: string; note: string | null; createdAt: string; patch: StudioPatch; dna: ToneDna; changes: string[] };

export function parseNote(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") fail("The revision note must be text.");
  const t = v.trim();
  if (t.length > MAX_NOTE) fail(`Revision notes are at most ${MAX_NOTE} characters.`);
  return t || null;
}

const same = (a: State, b: State) => a.name === b.name && JSON.stringify(a.data) === JSON.stringify(b.data) && JSON.stringify(a.rig) === JSON.stringify(b.rig);
const asJson = (v: Prisma.JsonValue | null) => (v === null ? undefined : (v as Prisma.InputJsonValue));

/** Inside the save's transaction: a snapshot of `after` (and, the first time, of `before` as the baseline). No-op when nothing changed. */
export async function recordVersion(tx: Prisma.TransactionClient, toneId: string, before: State | null, after: State, { kind, note }: { kind: ToneVersionKind; note: string | null }) {
  if (before && same(before, after)) return;
  const existing = await tx.toneVersion.count({ where: { toneId } });
  const now = Date.now();
  if (!existing && before) await tx.toneVersion.create({ data: { toneId, kind: "BASELINE", name: before.name, data: asJson(before.data), rig: asJson(before.rig), createdAt: new Date(now - 1) } });
  await tx.toneVersion.create({ data: { toneId, kind, name: after.name, data: asJson(after.data), rig: asJson(after.rig), note, createdAt: new Date(now) } });
  const old = await tx.toneVersion.findMany({ where: { toneId }, orderBy: { createdAt: "desc" }, skip: MAX_VERSIONS, select: { id: true } });
  if (old.length) await tx.toneVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
}

const patchOf = (v: { data: Prisma.JsonValue; rig: Prisma.JsonValue }) =>
  patchFromTone({ studio: studioPatchFromStored(v.data), declared: (v.rig as RigSpec | null) ?? null, inferred: recipeCoreFromStored(v.data) }).patch;

async function ownToneId(ownerId: string, toneId: string) {
  const ok = await prisma.tone.count({ where: { id: toneId, userId: ownerId } });
  if (!ok) throw new ApiError(404, "Tone not found.");
}

/** Newest first, each with what changed since the version before it. */
export async function listVersions(ownerId: string, toneId: string): Promise<ToneVersionView[]> {
  await ownToneId(ownerId, toneId);
  const rows = await prisma.toneVersion.findMany({ where: { toneId }, orderBy: { createdAt: "asc" }, take: MAX_VERSIONS });
  const patches = rows.map(patchOf);
  return rows
    .map((v, i): ToneVersionView => {
      const changes = i === 0 ? [] : diffPatches(patches[i - 1], patches[i]);
      if (i > 0 && rows[i - 1].name !== v.name) changes.unshift(`Renamed “${rows[i - 1].name}” → “${v.name}”`);
      if (i > 0 && !changes.length && JSON.stringify(rows[i - 1].rig) !== JSON.stringify(v.rig)) changes.push("Rig details changed");
      return { id: v.id, kind: v.kind, name: v.name, note: v.note, createdAt: v.createdAt.toISOString(), patch: patches[i], dna: dnaFromPatch(patches[i]), changes };
    })
    .reverse();
}

export async function setVersionNote(ownerId: string, toneId: string, versionId: string, note: string | null) {
  await ownToneId(ownerId, toneId);
  const { count } = await prisma.toneVersion.updateMany({ where: { id: versionId, toneId }, data: { note } });
  if (!count) throw new ApiError(404, "Version not found.");
}

/** The settings (data and rig, not the name) of an old version, for restoring through the normal save path. */
export async function versionSettings(ownerId: string, toneId: string, versionId: string) {
  await ownToneId(ownerId, toneId);
  const v = await prisma.toneVersion.findFirst({ where: { id: versionId, toneId }, select: { data: true, rig: true, createdAt: true } });
  if (!v) throw new ApiError(404, "Version not found.");
  return v;
}
