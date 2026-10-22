/**
 * A tiny per-process TTL cache for expensive, non-personal aggregates (landing
 * counts, trending tags). Every server instance keeps its own copy.
 * shortcut: in-memory only; move to a shared cache when running many instances.
 */
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load().catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, { at: Date.now(), value });
  return value;
}
