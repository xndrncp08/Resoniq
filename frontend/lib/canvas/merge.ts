/**
 * Three-way merge for the songwriting canvas, at section granularity. When
 * two people save from the same starting point, changes to different
 * sections both land; when both changed the same section, the other
 * person's version stays and yours is kept beside it as "(your edit)", so no
 * one's words are ever lost silently.
 */

export const SECTION_KINDS = ["intro", "verse", "pre-chorus", "chorus", "bridge", "solo", "breakdown", "outro", "other"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];
export type CanvasSection = { id: string; kind: SectionKind; name: string; lyrics: string; notes?: string; bars?: number; riffId?: string };
export type CanvasContent = { title: string; key: string | null; bpm: number | null; sections: CanvasSection[]; arrangement: string[] };
export type MergeResult = { merged: CanvasContent; conflicts: string[] };

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pick = <T>(base: T, local: T, remote: T): { value: T; conflict: boolean } =>
  eq(local, base) ? { value: remote, conflict: false } : eq(remote, base) || eq(local, remote) ? { value: local, conflict: false } : { value: local, conflict: true };

export function mergeCanvas(base: CanvasContent, local: CanvasContent, remote: CanvasContent, newId: () => string): MergeResult {
  const conflicts: string[] = [];
  const scalar = <K extends "title" | "key" | "bpm">(k: K) => {
    const r = pick(base[k], local[k], remote[k]);
    if (r.conflict) conflicts.push(`Both changed the ${k}; yours is kept.`);
    return r.value;
  };
  const byId = (c: CanvasContent) => new Map(c.sections.map((s) => [s.id, s]));
  const [B, L, R] = [byId(base), byId(local), byId(remote)];
  const copies = new Map<string, CanvasSection>();
  const sections: CanvasSection[] = [];
  // Remote order first (it's what others see), then anything only you added.
  const ids = [...new Set([...remote.sections.map((s) => s.id), ...local.sections.map((s) => s.id)])];
  for (const id of ids) {
    const b = B.get(id), l = L.get(id), r = R.get(id);
    if (l && r) {
      if (!b || eq(l, b) || eq(l, r)) sections.push(r);
      else if (eq(r, b)) sections.push(l);
      else {
        sections.push(r);
        const copy = { ...l, id: newId(), name: `${l.name} (your edit)` };
        copies.set(id, copy);
        sections.push(copy);
        conflicts.push(`“${l.name}” was changed by someone else too. Their version stays; yours is kept as “${copy.name}”.`);
      }
    } else if (r && !l) {
      // You deleted it: honour that unless they changed it meanwhile.
      if (b && !eq(r, b)) { sections.push(r); conflicts.push(`“${r.name}” was edited by someone else, so it wasn't deleted.`); }
      else if (!b) sections.push(r);
    } else if (l && !r) {
      // They deleted it: keep it only if you changed it (or added it).
      if (!b || !eq(l, b)) { sections.push(l); if (b) conflicts.push(`“${l.name}” was deleted by someone else; your edited copy is kept.`); }
    }
  }
  const present = new Set(sections.map((s) => s.id));
  let arrangement = eq(local.arrangement, base.arrangement) ? remote.arrangement : eq(remote.arrangement, base.arrangement) ? local.arrangement : [...remote.arrangement, ...local.arrangement.filter((id) => !remote.arrangement.includes(id))];
  arrangement = arrangement.flatMap((id) => (copies.has(id) ? [id, copies.get(id)!.id] : [id])).filter((id) => present.has(id));
  return { merged: { title: scalar("title"), key: scalar("key"), bpm: scalar("bpm"), sections, arrangement }, conflicts };
}
