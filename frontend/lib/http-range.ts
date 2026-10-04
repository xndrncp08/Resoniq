/** Parses a single `bytes=start-end` range. Returns null for absent or unsupported ranges. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  let start: number, end: number;
  if (!m[1]) {
    // Suffix range: the last N bytes.
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? "invalid" : { start, end };
}
