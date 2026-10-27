import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";

// Keys start with the user so nothing cached for one account answers for another.
export const notificationKeys = {
  all: (userId: string) => ["user", userId, "notifications"] as const,
  pulse: (userId: string) => ["user", userId, "pulse"] as const,
};

export type Pulse = { notifications: number; messages: number };

/**
 * Live counts for the nav (unread notifications, conversations with something
 * new): one small request every 15 s while the tab is visible, and right away
 * when it regains focus. Hidden tabs don't poll.
 */
export const pulseQuery = (userId: string, initial: Pulse) =>
  queryOptions({
    queryKey: notificationKeys.pulse(userId),
    queryFn: ({ signal }) => api<Pulse>("/api/pulse", { signal }),
    initialData: initial,
    // The server counts are fresh on every render.
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

export function usePulse(userId: string | null, initial: Pulse) {
  const query = useQuery({ ...pulseQuery(userId ?? "", initial), enabled: !!userId });
  return userId ? query.data : { notifications: 0, messages: 0 };
}

/** Unread notifications, shared by the desktop rail, the phone header and the notifications page. */
export function useUnreadCount(userId: string | null, initial: number) {
  return usePulse(userId, { notifications: initial, messages: 0 }).notifications;
}

/** Optimistically zero the notifications badge, put it back if the server refuses. */
export async function markAllReadOptimistic(client: QueryClient, userId: string, send: () => Promise<unknown>) {
  const key = notificationKeys.pulse(userId);
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData<Pulse>(key);
  if (previous) client.setQueryData<Pulse>(key, { ...previous, notifications: 0 });
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
