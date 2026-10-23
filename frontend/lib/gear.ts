import type { GearKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { memo } from "@/lib/memo";
import type { Actor } from "@/lib/authz";
import { fail, isUniqueViolation } from "@/lib/validation";
import { ApiError } from "@/lib/api-error";

export const GEAR_KINDS: GearKind[] = ["GUITAR", "BASS", "PICKUP", "AMP", "CAB", "PEDAL", "MULTIFX", "MODELER", "PLUGIN"];

/** Default control names per kind, used when a catalog item doesn't list its own. */
export const DEFAULT_CONTROLS: Partial<Record<GearKind, string[]>> = {
  AMP: ["Gain", "Bass", "Middle", "Treble", "Presence", "Master"],
  PEDAL: ["Level", "Tone", "Drive"],
};

export const GEAR_SELECT = { id: true, slug: true, kind: true, brand: true, model: true, description: true, controls: true, status: true } satisfies Prisma.GearItemSelect;

export const gearSlug = (brand: string, model: string) =>
  `${brand} ${model}`.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export async function searchGear(q: string, kind: GearKind | null, limit: number, viewerId: string | null) {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  return prisma.gearItem.findMany({
    where: {
      AND: [
        { OR: [{ status: "APPROVED" }, ...(viewerId ? [{ status: "PENDING" as const, createdById: viewerId }] : [])] },
        ...(kind ? [{ kind }] : []),
        ...terms.map((t) => ({ OR: [{ brand: { contains: t, mode: "insensitive" as const } }, { model: { contains: t, mode: "insensitive" as const } }] })),
      ],
    },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    take: limit,
    select: GEAR_SELECT,
  });
}

/** Most-used catalog gear across public tones; a full aggregate, so cached for five minutes per instance. */
export function popularGear(kind: GearKind | null, limit: number) {
  return memo(`popular-gear:${kind ?? "all"}:${limit}`, 300_000, () => loadPopularGear(kind, limit));
}

async function loadPopularGear(kind: GearKind | null, limit: number) {
  const rows = await prisma.$queryRaw<{ id: string; uses: bigint }[]>`
    SELECT g.id, COUNT(*) AS uses FROM "ToneGear" tg
    JOIN "GearItem" g ON g.id = tg."gearItemId" AND g.status = 'APPROVED'
    JOIN "Tone" t ON t.id = tg."toneId" AND t.visibility = 'PUBLIC'
    JOIN "User" u ON u.id = t."userId" AND u.status <> 'BANNED'
    WHERE (${kind}::text IS NULL OR g.kind::text = ${kind})
    GROUP BY g.id ORDER BY uses DESC, g.id LIMIT ${limit}`;
  const items = await prisma.gearItem.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: GEAR_SELECT });
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.flatMap((r) => (byId.has(r.id) ? [{ ...byId.get(r.id)!, uses: Number(r.uses) }] : []));
}

export function parseGearSubmission(body: Record<string, unknown>) {
  const kind = body.kind as GearKind;
  if (!GEAR_KINDS.includes(kind)) fail("Pick a gear type.");
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!brand || brand.length > 60 || !model || model.length > 80) fail("Brand (≤ 60) and model (≤ 80) are required.");
  const controls = Array.isArray(body.controls)
    ? body.controls.filter((c): c is string => typeof c === "string" && !!c.trim()).map((c) => c.trim().slice(0, 32)).slice(0, 16)
    : [];
  return { kind, brand, model, controls };
}

/** Members can propose catalog entries; they stay PENDING (usable only by the submitter) until staff approve. */
export async function submitGear(actor: Actor, input: ReturnType<typeof parseGearSubmission>) {
  try {
    return await prisma.gearItem.create({ data: { ...input, slug: gearSlug(input.brand, input.model), status: "PENDING", createdById: actor.id }, select: GEAR_SELECT });
  } catch (err) {
    if (isUniqueViolation(err, "slug")) throw new ApiError(409, "That gear is already in the catalog.");
    throw err;
  }
}
