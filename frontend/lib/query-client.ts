import { QueryClient } from "@tanstack/react-query";
import { ClientApiError } from "@/lib/client-api";

/**
 * Server state in the browser. Server Components own every page's first
 * render; the client cache only holds what changes while a page is open
 * (unread counts, catalog lookups) and serializes writes.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // A 4xx (signed out, not found, invalid) won't fix itself on retry.
        retry: (failures, err) => !(err instanceof ClientApiError && err.status < 500) && failures < 2,
      },
      mutations: { retry: false },
    },
  });
}
