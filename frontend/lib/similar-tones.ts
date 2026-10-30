import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTHOR_SELECT, type Author } from "@/lib/profiles";
import { ANONYMOUS_AUTHOR } from "@/lib/system-identity";
import { recipeCoreFromStored, studioPatchFromStored } from "@/lib/tone-recipe";
import { patchFromTone } from "@/lib/studio/from-tone";
import { DNA_AXES, DNA_VERSION, dnaColumns, dnaDifferences, dnaFromPatch, dnaMatch, type ToneDna } from "@/lib/tone-dna";
import type { RigSpec } from "@/types/rig";

export type SimilarTone = { id: string; name: string; author: Author; anonymous: boolean; generated: boolean; dna: ToneDna; match: number; differs: string[] };

/** A tone's fingerprint from its stored settings. */
export const dnaOfStored = (t: { data: Prisma.JsonValue; rig: Prisma.JsonValue }) =>
  dnaFromPatch(patchFromTone({ studio: studioPatchFromStored(t.data), declared: (t.rig as RigSpec | null) ?? null, inferred: recipeCoreFromStored(t.data) }).patch);

const BACKFILL_BATCH = 200;
/** Public tones whose stored fingerprint is missing or from an older formula get one (self-healing after deploys). */
export async function backfillDna(limit = BACKFILL_BATCH) {
  const stale = await prisma.tone.findMany({ where: { visibility: "PUBLIC", OR: [{ dnaVersion: null }, { dnaVersion: { not: DNA_VERSION } }] }, take: limit, select: { id: true, data: true, rig: true } });
  for (const t of stale) await prisma.tone.update({ where: { id: t.id }, data: dnaColumns(dnaOfStored(t)) });
  return stale.length;
}

// Candidates first come from an indexed band around the drive axis (the one that separates sounds most); the whole library is the fallback.
const DRIVE_BAND = 0.35;
const columns = { drive: "dnaDrive", low: "dnaLow", mid: "dnaMid", bright: "dnaBright", space: "dnaSpace", motion: "dnaMotion", squeeze: "dnaSqueeze" } as const;

async function nearest(dna: ToneDna, exclude: string | undefined, limit: number, band: boolean): Promise<{ id: string; dist: number }[]> {
  const distance = Prisma.join(DNA_AXES.map(({ key }) => Prisma.sql`power(t.${Prisma.raw(`"${columns[key]}"`)} - ${dna[key]}, 2)`), " + ");
  return prisma.$queryRaw<{ id: string; dist: number }[]>`
    SELECT t.id, (${distance}) AS dist
    FROM "Tone" t JOIN "User" u ON u.id = t."userId"
    WHERE t.visibility = 'PUBLIC' AND u.status <> 'BANNED' AND t."dnaVersion" = ${DNA_VERSION}
      ${exclude ? Prisma.sql`AND t.id <> ${exclude}` : Prisma.empty}
      ${band ? Prisma.sql`AND t."dnaDrive" BETWEEN ${dna.drive - DRIVE_BAND} AND ${dna.drive + DRIVE_BAND}` : Prisma.empty}
    ORDER BY dist ASC, t."saveCount" DESC, t.id DESC
    LIMIT ${limit}`;
}

/** Public tones whose DNA is closest to `dna`, best first. */
export async function similarTones(dna: ToneDna, { exclude, limit = 8 }: { exclude?: string; limit?: number } = {}): Promise<SimilarTone[]> {
  await backfillDna();
  let hits = await nearest(dna, exclude, limit, true);
  if (hits.length < limit) hits = await nearest(dna, exclude, limit, false);
  if (!hits.length) return [];
  const rows = await prisma.tone.findMany({
    where: { id: { in: hits.map((h) => h.id) } },
    select: { id: true, name: true, anonymous: true, origin: true, dnaDrive: true, dnaLow: true, dnaMid: true, dnaBright: true, dnaSpace: true, dnaMotion: true, dnaSqueeze: true, user: { select: AUTHOR_SELECT } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return hits.flatMap(({ id }) => {
    const t = byId.get(id);
    if (!t) return [];
    const other = Object.fromEntries(DNA_AXES.map(({ key }) => [key, t[columns[key]] ?? 0])) as ToneDna;
    return [{ id, name: t.name, author: t.anonymous ? ANONYMOUS_AUTHOR : t.user, anonymous: t.anonymous, generated: t.origin === "GENERATED", dna: other, match: dnaMatch(dna, other), differs: dnaDifferences(dna, other) }];
  });
}
