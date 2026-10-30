import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { ToneVersionView } from "@/lib/tone-versions";
import type { ToneView } from "@/lib/tones";
import { studioKeys } from "@/lib/queries/studio";
import { toneKeys, versionKeys } from "@/lib/queries/tones";

export { versionKeys };

export const versionsQuery = (userId: string, toneId: string) =>
  queryOptions({ queryKey: versionKeys.tone(userId, toneId), queryFn: ({ signal }) => api<{ versions: ToneVersionView[] }>(`/api/tones/${toneId}/versions`, { signal }).then((r) => r.versions), staleTime: 15_000 });

/** Restoring writes a new version and changes the tone: history, the preset list and the similar-tones cache all re-sync. */
export function useRestoreVersion(userId: string, toneId: string) {
  const client = useQueryClient();
  return useMutation({
    scope: { id: `tone:${toneId}` },
    mutationFn: (versionId: string) => api<{ tone: ToneView }>(`/api/tones/${toneId}/versions/${versionId}/restore`, { method: "POST" }).then((r) => r.tone),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: versionKeys.tone(userId, toneId) });
      void client.invalidateQueries({ queryKey: studioKeys.presets(userId) });
      void client.invalidateQueries({ queryKey: toneKeys.similar(toneId) });
    },
  });
}

/** Optimistic note edit with rollback. */
export function useVersionNote(userId: string, toneId: string) {
  const client = useQueryClient();
  const key = versionKeys.tone(userId, toneId);
  return useMutation({
    mutationFn: ({ versionId, note }: { versionId: string; note: string | null }) => api(`/api/tones/${toneId}/versions/${versionId}`, { method: "PATCH", body: { note } }),
    onMutate: async ({ versionId, note }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<ToneVersionView[]>(key);
      if (previous) client.setQueryData(key, previous.map((v) => (v.id === versionId ? { ...v, note } : v)));
      return previous;
    },
    onError: (_e, _v, previous) => previous && client.setQueryData(key, previous),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}
