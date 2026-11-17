import { PrismaClient } from "@prisma/client";

/**
 * Supabase's transaction pooler (port 6543) can't keep Prisma's prepared
 * statements between transactions ("prepared statement s0 already exists"),
 * so Prisma must be told it's behind PgBouncer. Added here when the URL
 * points at that pooler and doesn't say so already.
 *
 * Connection limit: one Vercel instance serves several requests at once, and
 * with a single connection every query of every one of them queues behind the
 * others (and fails with P2024 after the 10 s pool timeout). The transaction
 * pooler only borrows a database connection while a query or transaction runs,
 * and the free tier accepts 200 client connections, so a handful per instance
 * is safe. A value in the URL always wins.
 */
export const POOLER_CONNECTION_LIMIT = 5;

export function poolerSafeUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!url.hostname.endsWith(".pooler.supabase.com") || url.port !== "6543") return raw;
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", String(POOLER_CONNECTION_LIMIT));
  return url.toString();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = poolerSafeUrl(process.env.DATABASE_URL);
// One line per cold start, so production logs show the pool size actually in use (the URL itself is secret).
const limit = databaseUrl?.match(/[?&]connection_limit=(\d+)/)?.[1];
if (limit && process.env.NODE_ENV === "production") console.info(`[db] connection_limit=${limit}`);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
