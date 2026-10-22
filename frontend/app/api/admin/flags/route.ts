import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { clearFlagCache, FLAGS, type FlagKey } from "@/lib/flags";

/** { key, enabled } */
export const PUT = route("admin.flags.set", async (req) => {
  const actor = await requirePermission("platform.config");
  const { key, enabled } = await readJson(req);
  if (typeof key !== "string" || !(key in FLAGS) || typeof enabled !== "boolean") throw new ApiError(400, "Unknown flag.");
  await prisma.$transaction(async (tx) => {
    await tx.featureFlag.upsert({ where: { key }, create: { key, enabled, description: FLAGS[key as FlagKey].description, updatedById: actor.id }, update: { enabled, updatedById: actor.id } });
    await recordAudit(tx, { actorId: actor.id, action: "flag.set", targetType: "FeatureFlag", targetId: key, meta: { enabled } });
  });
  // shortcut: other server instances pick the change up within the 30 s flag cache.
  clearFlagCache();
  return NextResponse.json({ ok: true });
});
