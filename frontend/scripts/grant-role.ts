/**
 * Grants a platform role from the command line — the only way to create the
 * first admin, since nothing in the UI can escalate to ADMIN without one.
 *
 *   npm run admin:grant -- --email you@example.com --role ADMIN
 */
import { parseArgs } from "node:util";
import type { PrismaClient, Role } from "@prisma/client";
import { recordAudit } from "@/lib/audit";

const ROLES: Role[] = ["USER", "MODERATOR", "ADMIN"];

export async function grantRole(db: PrismaClient, { email, role }: { email: string; role: Role }) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
    if (!user) throw new Error("No user with that email.");
    await tx.user.update({ where: { id: user.id }, data: { role } });
    await recordAudit(tx, {
      actorId: null,
      action: "user.role.grant",
      targetType: "User",
      targetId: user.id,
      meta: { via: "cli", previous: user.role, role },
    });
    return { id: user.id, previous: user.role };
  });
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, role: { type: "string", default: "ADMIN" } } });
  const role = values.role?.toUpperCase() as Role;
  if (!values.email || !ROLES.includes(role)) {
    console.error("Usage: npm run admin:grant -- --email <email> --role USER|MODERATOR|ADMIN");
    process.exit(1);
  }
  const { prisma } = await import("@/lib/prisma");
  try {
    const { previous } = await grantRole(prisma, { email: values.email, role });
    console.log(`Role changed from ${previous} to ${role}.`);
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("grant-role.ts")) void main();
