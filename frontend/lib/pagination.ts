import { ApiError } from "@/lib/api-error";

/** Keyset cursor: the sort key of the last item plus its id as a tie-breaker. */
export type Cursor = { t: string; id: string };

export const encodeCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString("base64url");

export function decodeCursor(s: string | null): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as unknown;
    if (c && typeof c === "object" && typeof (c as Cursor).t === "string" && typeof (c as Cursor).id === "string") {
      return c as Cursor;
    }
  } catch {
    // fall through
  }
  throw new ApiError(400, "Invalid cursor.");
}

export function parseLimit(v: string | null, fallback = 20, max = 50): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

/** Slices one extra row off a `limit + 1` query and builds the next cursor from the last kept row. */
export function page<T>(rows: T[], limit: number, cursorOf: (row: T) => Cursor) {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(cursorOf(last)) : null };
}
