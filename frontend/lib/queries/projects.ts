import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProjectStage } from "@prisma/client";
import { api } from "@/lib/client-api";
import type { ProjectView } from "@/lib/projects";
import { conversationKeys } from "@/lib/queries/conversations";

export const projectKeys = { all: (userId: string) => ["user", userId, "projects"] as const, one: (userId: string, id: string) => ["user", userId, "projects", id] as const };

export const projectsQuery = (userId: string) => queryOptions({ queryKey: projectKeys.all(userId), queryFn: ({ signal }) => api<{ projects: ProjectView[] }>("/api/projects", { signal }).then((r) => r.projects), staleTime: 15_000 });
export const projectQuery = (userId: string, id: string) => queryOptions({ queryKey: projectKeys.one(userId, id), queryFn: ({ signal }) => api<{ project: ProjectView }>(`/api/projects/${id}`, { signal }).then((r) => r.project), staleTime: 15_000 });

/** Optimistic stage change; rolls back if refused. The thread gets a system message, so conversations re-sync too. */
export function useProjectStage(userId: string, id: string) {
  const client = useQueryClient();
  const key = projectKeys.one(userId, id);
  return useMutation({
    mutationFn: (body: { stage?: ProjectStage; finished?: boolean }) => api<{ project: ProjectView }>(`/api/projects/${id}`, { method: "PATCH", body }).then((r) => r.project),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<ProjectView>(key);
      if (previous) client.setQueryData<ProjectView>(key, { ...previous, ...(body.stage && { stage: body.stage, stageSet: true }), ...(body.finished !== undefined && { completedAt: body.finished ? new Date().toISOString() : null }) });
      return previous;
    },
    onError: (_e, _b, previous) => previous && client.setQueryData(key, previous),
    onSuccess: (p) => client.setQueryData(key, p),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: projectKeys.all(userId), exact: true });
      void client.invalidateQueries({ queryKey: conversationKeys.all(userId) });
    },
  });
}
