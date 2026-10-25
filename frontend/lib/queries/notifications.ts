import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";

// Keys start with the user so nothing cached for one account answers for another.
export const notificationKeys = {
  all: (userId: string) => ["user", userId, "notifications"] as const,
  unread: (userId: string) => [...notificationKeys.all(userId), "unread"] as const,
};

export const unreadQuery = (userId: string, initial: number) =>
  queryOptions({
    queryKey: notificationKeys.unread(userId),
    queryFn: ({ signal }) => api<{ unread: number }>("/api/notifications?count=1", { signal }).then((r) => r.unread),
    initialData: initial,
    // The server count is fresh on every render; poll gently while the tab is visible.
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: 60_000,
  });

/** Unread count shared by the desktop rail, the phone header and the notifications page. */
export function useUnreadCount(userId: string | null, initial: number) {
  const query = useQuery({ ...unreadQuery(userId ?? "", initial), enabled: !!userId });
  return userId ? query.data : 0;
}

/** Optimistically zero the badge, put it back if the server refuses. */
export async function markAllReadOptimistic(client: QueryClient, userId: string, send: () => Promise<unknown>) {
  const key = notificationKeys.unread(userId);
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData<number>(key);
  client.setQueryData(key, 0);
  try {
    await send();
  } catch (err) {
    client.setQueryData(key, previous);
    throw err;
  } finally {
    void client.invalidateQueries({ queryKey: key });
  }
}

export function useMarkAllRead(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...notificationKeys.all(userId), "read-all"],
    mutationFn: () => markAllReadOptimistic(client, userId, () => api("/api/notifications/read", { body: { all: true } })),
  });
}
