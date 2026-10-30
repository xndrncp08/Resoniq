import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { CanvasSummary, CanvasView, RevisionView } from "@/lib/canvas/service";
import type { CanvasContent } from "@/lib/canvas/merge";

export const canvasKeys = {
  all: (userId: string) => ["user", userId, "canvases"] as const,
  list: (userId: string, projectId?: string) => ["user", userId, "canvases", "list", projectId ?? null] as const,
  one: (userId: string, id: string) => ["user", userId, "canvases", "one", id] as const,
  revisions: (userId: string, id: string) => ["user", userId, "canvases", "revisions", id] as const,
};

export const canvasesQuery = (userId: string, projectId?: string) =>
  queryOptions({ queryKey: canvasKeys.list(userId, projectId), queryFn: ({ signal }) => api<{ canvases: CanvasSummary[] }>(`/api/canvases${projectId ? `?project=${projectId}` : ""}`, { signal }).then((r) => r.canvases), staleTime: 30_000 });

/** Polled while the page is visible so collaborators' saves show up. */
export const canvasQuery = (userId: string, id: string) =>
  queryOptions({ queryKey: canvasKeys.one(userId, id), queryFn: ({ signal }) => api<{ canvas: CanvasView }>(`/api/canvases/${id}`, { signal }).then((r) => r.canvas), refetchInterval: 4000, refetchIntervalInBackground: false });

export const revisionsQuery = (userId: string, id: string) =>
  queryOptions({ queryKey: canvasKeys.revisions(userId, id), queryFn: ({ signal }) => api<{ revisions: RevisionView[] }>(`/api/canvases/${id}/revisions`, { signal }).then((r) => r.revisions) });

export function useCreateCanvas(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; projectId?: string; fromRiffId?: string }) => api<{ canvas: CanvasView }>("/api/canvases", { body }).then((r) => r.canvas),
    onSuccess: (c) => client.setQueryData(canvasKeys.one(userId, c.id), c),
    onSettled: () => client.invalidateQueries({ queryKey: [...canvasKeys.all(userId), "list"] }),
  });
}

/** One save in flight per song, in order. The detail cache takes the server's answer. */
export function useSaveCanvas(userId: string, id: string) {
  const client = useQueryClient();
  return useMutation({
    scope: { id: `canvas:${id}` },
    mutationFn: ({ baseVersion, content }: { baseVersion: number; content: CanvasContent }) => api<{ canvas: CanvasView }>(`/api/canvases/${id}`, { method: "PUT", body: { baseVersion, ...content } }).then((r) => r.canvas),
    onSuccess: (c) => {
      client.setQueryData(canvasKeys.one(userId, id), c);
      void client.invalidateQueries({ queryKey: canvasKeys.revisions(userId, id) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: [...canvasKeys.all(userId), "list"] }),
  });
}

export function useCanvasProject(userId: string, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string | null) => api<{ canvas: CanvasView }>(`/api/canvases/${id}`, { method: "PATCH", body: { projectId } }).then((r) => r.canvas),
    onSuccess: (c) => client.setQueryData(canvasKeys.one(userId, id), c),
    onSettled: () => client.invalidateQueries({ queryKey: [...canvasKeys.all(userId), "list"] }),
  });
}

export function useDeleteCanvas(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/canvases/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => client.removeQueries({ queryKey: canvasKeys.one(userId, id) }),
    onSettled: () => client.invalidateQueries({ queryKey: [...canvasKeys.all(userId), "list"] }),
  });
}
