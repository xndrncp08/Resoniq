import { NextResponse } from "next/server";
import type { ModerationRuleKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { clearRuleCache } from "@/lib/automod";
import { parseRuleConfig, RULE_KINDS } from "@/lib/admin/rules";

export const POST = route("admin.rules.create", async (req) => {
  const actor = await requirePermission("platform.config");
  const body = await readJson(req);
  const kind = body.kind as ModerationRuleKind;
  if (!RULE_KINDS.includes(kind)) throw new ApiError(400, "Unknown rule type.");
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : kind;
  const config = parseRuleConfig(kind, body.config);
  const rule = await prisma.$transaction(async (tx) => {
    const r = await tx.moderationRule.create({ data: { kind, label, config: config as Prisma.InputJsonValue } });
    await recordAudit(tx, { actorId: actor.id, action: "rule.create", targetType: "ModerationRule", targetId: r.id, meta: { kind } });
    return r;
  });
  clearRuleCache();
  return NextResponse.json({ rule }, { status: 201 });
});
