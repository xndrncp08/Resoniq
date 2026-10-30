import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import { recipeCoreFromStored, studioPatchFromStored } from "@/lib/tone-recipe";
import type { RecipeCore } from "@/types/tone";
import type { RigSpec } from "@/types/rig";
import type { StudioPatch } from "@/lib/studio/patch";
import { tankGRigFromPatch } from "@/lib/studio/devices";

export type StudioPreset = { id: string; name: string; studio: StudioPatch | null; declared: RigSpec | null; inferred: RecipeCore | null; updatedAt: string };

export const studioKeys = { presets: (userId: string) => ["user", userId, "studio", "presets"] as const };

type ToneRow = { id: string; name: string; data: unknown; rig: unknown; updatedAt: string };

/** The signed-in musician's own tones, as things the studio can open. */
export const presetsQuery = (userId: string) =>
  queryOptions({
    queryKey: studioKeys.presets(userId),
    queryFn: ({ signal }) =>
      api<{ tones: ToneRow[] }>("/api/tones", { signal }).then((r) =>
        r.tones.map((t): StudioPreset => ({ id: t.id, name: t.name, studio: studioPatchFromStored(t.data), declared: (t.rig as RigSpec | null) ?? null, inferred: recipeCoreFromStored(t.data), updatedAt: t.updatedAt })),
      ),
    staleTime: 60_000,
  });

/** What the studio is editing and what it may do with it. */
export type StudioOrigin = {
  toneId: string | null;
  name: string;
  isOwner: boolean;
  /** Who can open the saved sound (for sharing). */
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
  /** The preset's rig when it's a device preset: saving writes the edited rig back. */
  deviceRig: RigSpec | null;
  /** Analysis provenance to keep when saving a new tone from an analysed song (see analysis sections). */
  songId?: string | null;
  sectionId?: string | null;
  recipe?: RecipeCore | null;
};

export type SaveMode = "update" | "new";

/** The body the tones API stores for this patch: a device rig, or a studio patch beside any analysis recipe. */
export function saveBody(patch: StudioPatch, origin: StudioOrigin) {
  if (patch.device && origin.deviceRig) return { rig: tankGRigFromPatch(patch, origin.deviceRig) };
  return { data: { version: 2, studio: patch, ...(origin.recipe && { recipe: origin.recipe }) } };
}

/**
 * Save in place (your own tone), or as a new tone. A new tone from someone
 * else's sound goes through remix, so it's credited to them. The preset list
 * updates immediately and rolls back if the server refuses.
 */
export function useSaveStudio(userId: string) {
  const client = useQueryClient();
  const key = studioKeys.presets(userId);
  return useMutation({
    scope: { id: key.join(":") },
    mutationFn: async ({ patch, origin, mode, name }: { patch: StudioPatch; origin: StudioOrigin; mode: SaveMode; name: string }) => {
      const body = saveBody(patch, origin);
      if (mode === "update" && origin.toneId && origin.isOwner) {
        await api(`/api/tones/${origin.toneId}`, { method: "PATCH", body: { ...body, name } });
        return { id: origin.toneId, name };
      }
      if (origin.toneId && !origin.isOwner) {
        const { tone } = await api<{ tone: { id: string } }>(`/api/tones/${origin.toneId}/remix`, { method: "POST" });
        await api(`/api/tones/${tone.id}`, { method: "PATCH", body: { ...body, name } });
        return { id: tone.id, name };
      }
      const { tone } = await api<{ tone: { id: string } }>("/api/tones", { body: { ...body, name, visibility: "PRIVATE", ...(origin.songId && { songId: origin.songId }), ...(origin.sectionId && { sectionId: origin.sectionId }) } });
      return { id: tone.id, name };
    },
    onMutate: async ({ patch, origin, mode, name }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<StudioPreset[]>(key);
      if (previous) {
        const entry: StudioPreset = { id: mode === "update" && origin.toneId ? origin.toneId : `pending-${Date.now()}`, name, studio: patch.device ? null : patch, declared: null, inferred: null, updatedAt: new Date().toISOString() };
        client.setQueryData(key, [entry, ...previous.filter((p) => p.id !== entry.id)]);
      }
      return previous;
    },
    onError: (_err, _vars, previous) => {
      if (previous) client.setQueryData(key, previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}
