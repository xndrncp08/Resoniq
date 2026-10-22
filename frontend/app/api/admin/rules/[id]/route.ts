import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { clearRuleCache } from "@/lib/automod";
import { parseRuleConfig } from "@/lib/admin/rules";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>("admin.rules.update", async (req, { params }) => {
  const actor = await requirePermission("platform.config");
  const { id } = await params;
  const rule = await prisma.moderationRule.findUnique({ where: { id } });
  if (!rule) throw new ApiError(404, "Rule not found.");
  const body = await readJson(req, 64 * 1024);
  const data: Prisma.ModerationRuleUpdateInput = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.config !== undefined) data.config = parseRuleConfig(rule.kind, body.config) as Prisma.InputJsonValue;
  await prisma.$transaction(async (tx) => {
    await tx.moderationRule.update({ where: { id }, data });
    await recordAudit(tx, { actorId: actor.id, action: "rule.update", targetType: "ModerationRule", targetId: id, meta: { fields: Object.keys(data) } });
  });
  clearRuleCache();
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Ctx>("admin.rules.delete", async (_req, { params }) => {
  const actor = await requirePermission("platform.config");
  const { id } = await params;
  await prisma.$transaction(async (tx) => {
    await tx.moderationRule.delete({ where: { id } });
    await recordAudit(tx, { actorId: actor.id, action: "rule.delete", targetType: "ModerationRule", targetId: id });
  });
  clearRuleCache();
  return NextResponse.json({ ok: true });
});
