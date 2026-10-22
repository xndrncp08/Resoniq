/** Browser-side JSON calls to this app's API. Errors carry the server's user-facing message. */
export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? (res.status === 401 ? "Sign in to do that." : "Something went wrong. Try again.");
    throw new ClientApiError(res.status, message);
  }
  return data as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Try again.");
