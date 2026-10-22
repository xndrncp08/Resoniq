import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  meta?: Prisma.InputJsonValue;
};

/** Pass the same transaction as the change being audited, so both commit or neither does. */
export async function recordAudit(db: PrismaClient | Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({ data: entry });
}
