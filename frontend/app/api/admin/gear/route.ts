import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { gearSlug, GEAR_SELECT, parseGearSubmission } from "@/lib/gear";
import { isUniqueViolation } from "@/lib/validation";

export const POST = route("admin.gear.create", async (req) => {
  const actor = await requirePermission("catalog.manage");
  const input = parseGearSubmission(await readJson(req));
  try {
    const item = await prisma.$transaction(async (tx) => {
      const g = await tx.gearItem.create({ data: { ...input, slug: gearSlug(input.brand, input.model), status: "APPROVED", createdById: actor.id }, select: GEAR_SELECT });
      await recordAudit(tx, { actorId: actor.id, action: "gear.create", targetType: "GearItem", targetId: g.id });
      return g;
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err, "slug")) throw new ApiError(409, "That gear is already in the catalog.");
    throw err;
  }
});
