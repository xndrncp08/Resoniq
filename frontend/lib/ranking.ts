// 2026-01-01T00:00:00Z. Any fixed epoch works; it only shifts every rank equally.
const EPOCH_S = 1_767_225_600;

/**
 * Reddit-style hot rank. Ten times the score buys the same lift as 12.5 hours
 * of recency. It doesn't change as time passes, so it is stored and indexed.
 */
export function hotRank(score: number, createdAt: Date): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  return Number((sign * order + (createdAt.getTime() / 1000 - EPOCH_S) / 45_000).toFixed(7));
}
