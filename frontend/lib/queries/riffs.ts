import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RiffStage } from "@prisma/client";
import { api } from "@/lib/client-api";
import { putWithProgress } from "@/lib/upload-client";
import type { RiffInput, RiffSummary, RiffView } from "@/lib/riffs/service";

export type RiffFilters = { q?: string; tag?: string; stage?: RiffStage; project?: string };

export const riffKeys = {
  all: (userId: string) => ["user", userId, "riffs"] as const,
  list: (userId: string, f: RiffFilters) => ["user", userId, "riffs", "list", f] as const,
  one: (userId: string, id: string) => ["user", userId, "riffs", "one", id] as const,
};

export const riffsQuery = (userId: string, f: RiffFilters = {}) =>
  queryOptions({
    queryKey: riffKeys.list(userId, f),
    queryFn: ({ signal }) => {
      const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
      return api<{ riffs: RiffSummary[] }>(`/api/riffs?${p}`, { signal }).then((r) => r.riffs);
    },
    staleTime: 30_000,
  });

export const riffQuery = (userId: string, id: string) =>
  queryOptions({ queryKey: riffKeys.one(userId, id), queryFn: ({ signal }) => api<{ riff: RiffView }>(`/api/riffs/${id}`, { signal }).then((r) => r.riff), staleTime: 30_000 });

/** Lists re-sync after any change to a riff; the detail cache takes the server's answer. */
function useRiffCache(userId: string) {
  const client = useQueryClient();
  return {
    client,
    put: (riff: RiffView) => client.setQueryData(riffKeys.one(userId, riff.id), riff),
    lists: () => client.invalidateQueries({ queryKey: [...riffKeys.all(userId), "list"] }),
    detail: (id: string) => client.invalidateQueries({ queryKey: riffKeys.one(userId, id) }),
  };
}

export function useCreateRiff(userId: string) {
  const c = useRiffCache(userId);
  return useMutation({ mutationFn: (body: Partial<RiffInput>) => api<{ riff: RiffView }>("/api/riffs", { body }).then((r) => r.riff), onSuccess: c.put, onSettled: c.lists });
}

/** Optimistic: the detail shows the change at once and rolls back if refused. */
export function useSaveRiff(userId: string, id: string) {
  const c = useRiffCache(userId);
  const key = riffKeys.one(userId, id);
  return useMutation({
    scope: { id: `riff:${id}` },
    mutationFn: (patch: Partial<RiffInput>) => api<{ riff: RiffView }>(`/api/riffs/${id}`, { method: "PATCH", body: patch }).then((r) => r.riff),
    onMutate: async (patch) => {
      await c.client.cancelQueries({ queryKey: key });
      const previous = c.client.getQueryData<RiffView>(key);
      if (previous) c.client.setQueryData<RiffView>(key, { ...previous, ...patch, tone: patch.toneId === undefined ? previous.tone : previous.tone?.id === patch.toneId ? previous.tone : null } as RiffView);
      return previous;
    },
    onError: (_e, _p, previous) => previous && c.client.setQueryData(key, previous),
    onSuccess: c.put,
    onSettled: c.lists,
  });
}

export function useDeleteRiff(userId: string) {
  const c = useRiffCache(userId);
  return useMutation({
    mutationFn: (id: string) => api(`/api/riffs/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => c.client.removeQueries({ queryKey: riffKeys.one(userId, id) }),
    onSettled: c.lists,
  });
}

export type TakeUpload = { blob: Blob; durationSec: number | null; peaks: number[] | null; label?: string };

/** Reserve → PUT (with progress) → complete. Cancellable via the signal. */
export function useUploadTake(userId: string, riffId: string) {
  const c = useRiffCache(userId);
  return useMutation({
    scope: { id: `riff:${riffId}:takes` },
    mutationFn: async ({ take, onProgress, signal }: { take: TakeUpload; onProgress?: (f: number) => void; signal?: AbortSignal }) => {
      const created = await api<{ id: string; upload: { method: string; url: string; headers: Record<string, string> } }>(`/api/riffs/${riffId}/takes`, {
        body: { size: take.blob.size, mime: take.blob.type, durationSec: take.durationSec, peaks: take.peaks, label: take.label },
      });
      await putWithProgress(created.upload, take.blob, { onProgress, signal });
      await api(`/api/riff-takes/${created.id}/complete`, { method: "POST" });
      return created.id;
    },
    onSettled: () => { void c.detail(riffId); void c.lists(); },
  });
}

export function useDeleteTake(userId: string, riffId: string) {
  const c = useRiffCache(userId);
  const key = riffKeys.one(userId, riffId);
  return useMutation({
    mutationFn: (takeId: string) => api(`/api/riff-takes/${takeId}`, { method: "DELETE" }),
    onMutate: async (takeId) => {
      await c.client.cancelQueries({ queryKey: key });
      const previous = c.client.getQueryData<RiffView>(key);
      if (previous) c.client.setQueryData<RiffView>(key, { ...previous, allTakes: previous.allTakes.filter((t) => t.id !== takeId), takes: previous.takes - 1 });
      return previous;
    },
    onError: (_e, _id, previous) => previous && c.client.setQueryData(key, previous),
    onSettled: () => { void c.detail(riffId); void c.lists(); },
  });
}

export function useRenameTake(userId: string, riffId: string) {
  const c = useRiffCache(userId);
  return useMutation({ mutationFn: ({ takeId, label }: { takeId: string; label: string | null }) => api(`/api/riff-takes/${takeId}`, { method: "PATCH", body: { label } }), onSettled: () => c.detail(riffId) });
}
