import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { ConversationSummary } from "@/lib/messaging-shared";

/** One cache entry per kind of list, shared by the inbox and anything that offers "pick a project". */
export const conversationKeys = { all: (userId: string) => ["user", userId, "conversations"] as const, list: (userId: string, kind: "DIRECT" | "PROJECT" | null) => ["user", userId, "conversations", kind ?? "all"] as const };

export const conversationsQuery = (userId: string, kind: "DIRECT" | "PROJECT" | null) =>
  queryOptions({ queryKey: conversationKeys.list(userId, kind), queryFn: ({ signal }) => api<{ items: ConversationSummary[] }>(`/api/conversations${kind ? `?kind=${kind}` : ""}`, { signal }).then((r) => r.items), staleTime: 10_000 });
