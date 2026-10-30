import { prisma } from "@/lib/prisma";
import { AUTHOR_SELECT, type Author } from "@/lib/profiles";
import { ANONYMOUS_AUTHOR } from "@/lib/system-identity";
import { listedToneWhere } from "@/lib/tones";
import { recipeCoreFromStored, studioPatchFromStored } from "@/lib/tone-recipe";
import { patchFromTone } from "@/lib/studio/from-tone";
import { dnaDifferences, dnaFromPatch, dnaMatch, type ToneDna } from "@/lib/tone-dna";
import type { RigSpec } from "@/types/rig";

export type SimilarTone = { id: string; name: string; author: Author; anonymous: boolean; generated: boolean; dna: ToneDna; match: number; differs: string[] };

// shortcut: scores the 500 most-saved public tones in memory per request; precompute a stored DNA column once the library outgrows that.
const CANDIDATES = 500;

/** Public tones whose DNA is closest to `dna`, best first. */
export async function similarTones(dna: ToneDna, { exclude, limit = 8 }: { exclude?: string; limit?: number } = {}): Promise<SimilarTone[]> {
  const rows = await prisma.tone.findMany({
    where: { ...listedToneWhere, ...(exclude && { id: { not: exclude } }) },
    orderBy: [{ saveCount: "desc" }, { id: "desc" }],
    take: CANDIDATES,
    select: { id: true, name: true, data: true, rig: true, anonymous: true, origin: true, user: { select: AUTHOR_SELECT } },
  });
  return rows
    .map((t) => {
      const other = dnaFromPatch(patchFromTone({ studio: studioPatchFromStored(t.data), declared: (t.rig as RigSpec | null) ?? null, inferred: recipeCoreFromStored(t.data) }).patch);
      return { id: t.id, name: t.name, author: t.anonymous ? ANONYMOUS_AUTHOR : t.user, anonymous: t.anonymous, generated: t.origin === "GENERATED", dna: other, match: dnaMatch(dna, other), differs: dnaDifferences(dna, other) };
    })
    .sort((a, b) => b.match - a.match)
    .slice(0, limit);
}
