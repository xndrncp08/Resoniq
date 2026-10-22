/** A user-facing input problem; routes turn it into a 400. */
export class ValidationError extends Error {}

export function fail(message: string): never {
  throw new ValidationError(message);
}

/** True when a Prisma unique-constraint error (P2002) names `field`. */
export function isUniqueViolation(err: unknown, field?: string): boolean {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== "P2002") return false;
  if (!field) return true;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}
