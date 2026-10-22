import { prisma } from "@/lib/prisma";

export { prisma };

/** Empties every table except Prisma's migration ledger. */
export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export function makeUser(data: { email?: string; name?: string; handle?: string } = {}) {
  return prisma.user.create({ data: { email: data.email ?? `${Math.random().toString(36).slice(2)}@test.dev`, ...data } });
}
