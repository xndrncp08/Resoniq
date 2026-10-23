import { PrismaClient } from "@prisma/client";

/**
 * Supabase's transaction pooler (port 6543) can't keep Prisma's prepared
 * statements between transactions ("prepared statement s0 already exists"),
 * so Prisma must be told it's behind PgBouncer. Added here when the URL
 * points at that pooler and doesn't say so already.
 */
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
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  return url.toString();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = poolerSafeUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
