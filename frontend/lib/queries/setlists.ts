import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { SetlistInput, SetlistSummary, SetlistView } from "@/lib/setlists";

export const setlistKeys = {
  all: (userId: string) => ["user", userId, "setlists"] as const,
  one: (userId: string, id: string) => ["user", userId, "setlists", id] as const,
};

export const setlistsQuery = (userId: string) =>
  queryOptions({ queryKey: setlistKeys.all(userId), queryFn: ({ signal }) => api<{ setlists: SetlistSummary[] }>("/api/setlists", { signal }).then((r) => r.setlists), staleTime: 60_000 });

export const setlistQuery = (userId: string, id: string) =>
  queryOptions({ queryKey: setlistKeys.one(userId, id), queryFn: ({ signal }) => api<{ setlist: SetlistView }>(`/api/setlists/${id}`, { signal }).then((r) => r.setlist), staleTime: 60_000 });

export function useCreateSetlist(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<SetlistInput, "name"> & Partial<SetlistInput>) => api<{ setlist: SetlistView }>("/api/setlists", { body }).then((r) => r.setlist),
    onSuccess: (setlist) => client.setQueryData(setlistKeys.one(userId, setlist.id), setlist),
    onSettled: () => client.invalidateQueries({ queryKey: setlistKeys.all(userId), exact: true }),
  });
}

/** Saves edits; the detail cache takes the server's answer, the list re-syncs. Serialized per setlist so saves land in order. */
export function useSaveSetlist(userId: string, id: string) {
  const client = useQueryClient();
  return useMutation({
    scope: { id: `setlist:${id}` },
    mutationFn: (patch: Partial<SetlistInput>) => api<{ setlist: SetlistView }>(`/api/setlists/${id}`, { method: "PATCH", body: patch }).then((r) => r.setlist),
    onSuccess: (setlist) => client.setQueryData(setlistKeys.one(userId, id), setlist),
    onSettled: () => client.invalidateQueries({ queryKey: setlistKeys.all(userId), exact: true }),
  });
}

/** Removes it from the list at once and puts it back if the server refuses. */
export function useDeleteSetlist(userId: string) {
  const client = useQueryClient();
  const key = setlistKeys.all(userId);
  return useMutation({
    mutationFn: (id: string) => api(`/api/setlists/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key, exact: true });
      const previous = client.getQueryData<SetlistSummary[]>(key);
      if (previous) client.setQueryData(key, previous.filter((s) => s.id !== id));
      return previous;
    },
    onError: (_e, _id, previous) => previous && client.setQueryData(key, previous),
    onSuccess: (_r, id) => client.removeQueries({ queryKey: setlistKeys.one(userId, id) }),
    onSettled: () => client.invalidateQueries({ queryKey: key, exact: true }),
  });
}
