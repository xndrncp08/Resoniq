import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { PassageView, TakeView } from "@/lib/practice-ladder";

export const practiceKeys = {
  passages: (userId: string) => ["user", userId, "practice", "passages"] as const,
};

export const passagesQuery = (userId: string) =>
  queryOptions({
    queryKey: practiceKeys.passages(userId),
    queryFn: ({ signal }) => api<{ items: PassageView[] }>("/api/practice/passages", { signal }).then((r) => r.items),
    staleTime: 60_000,
  });

/**
 * Writes that change the ladder: each updates the cache first, rolls back on
 * failure, and re-syncs with the server once settled.
 */
function usePassagesMutation<V, R>(userId: string, mutationFn: (vars: V) => Promise<R>, optimistic?: (list: PassageView[], vars: V) => PassageView[]) {
  const client = useQueryClient();
  const key = practiceKeys.passages(userId);
  return useMutation({
    scope: { id: key.join(":") },
    mutationFn,
    onMutate: async (vars: V) => {
      if (!optimistic) return undefined;
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<PassageView[]>(key);
      if (previous) client.setQueryData(key, optimistic(previous, vars));
      return previous;
    },
    onError: (_err, _vars, previous) => {
      if (previous) client.setQueryData(key, previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

export const withTake = (list: PassageView[], passageId: string, take: TakeView) =>
  list.map((p) => (p.id === passageId ? { ...p, updatedAt: take.createdAt, takes: [...p.takes, take] } : p));

export const withoutTake = (list: PassageView[], takeId: string) => list.map((p) => ({ ...p, takes: p.takes.filter((t) => t.id !== takeId) }));

export function useCreatePassage(userId: string) {
  return usePassagesMutation(userId, (body: { title: string; targetBpm: number }) => api<{ passage: PassageView }>("/api/practice/passages", { body }).then((r) => r.passage));
}

export function useLogTake(userId: string) {
  return usePassagesMutation(
    userId,
    ({ passageId, bpm, clean }: { passageId: string; bpm: number; clean: boolean }) => api<{ take: TakeView }>(`/api/practice/passages/${passageId}/takes`, { body: { bpm, clean } }),
    (list, { passageId, bpm, clean }) => withTake(list, passageId, { id: `pending-${Date.now()}`, bpm, clean, createdAt: new Date().toISOString() }),
  );
}

export function useDeleteTake(userId: string) {
  return usePassagesMutation(userId, (takeId: string) => api(`/api/practice/takes/${takeId}`, { method: "DELETE" }), withoutTake);
}

export function useUpdatePassage(userId: string) {
  return usePassagesMutation(
    userId,
    ({ id, ...body }: { id: string; title?: string; targetBpm?: number }) => api(`/api/practice/passages/${id}`, { method: "PATCH", body }),
    (list, { id, ...patch }) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
}

export function useDeletePassage(userId: string) {
  return usePassagesMutation(userId, (id: string) => api(`/api/practice/passages/${id}`, { method: "DELETE" }), (list, id) => list.filter((p) => p.id !== id));
}
