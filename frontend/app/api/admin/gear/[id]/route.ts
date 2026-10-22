import { NextResponse } from "next/server";
import type { GearStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
const STATUSES: GearStatus[] = ["APPROVED", "PENDING", "REJECTED"];

/** { status?, brand?, model?, controls? } */
export const PATCH = route<Ctx>("admin.gear.update", async (req, { params }) => {
  const actor = await requirePermission("catalog.manage");
  const { id } = await params;
  const body = await readJson(req);
  const data: Prisma.GearItemUpdateInput = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as GearStatus)) throw new ApiError(400, "Unknown status.");
    data.status = body.status as GearStatus;
  }
  for (const k of ["brand", "model"] as const) if (typeof body[k] === "string" && body[k].trim()) data[k] = (body[k] as string).trim().slice(0, 80);
  if (Array.isArray(body.controls)) data.controls = body.controls.filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, 32)).filter(Boolean).slice(0, 16);
  await prisma.$transaction(async (tx) => {
    const g = await tx.gearItem.update({ where: { id }, data }).catch(() => null);
    if (!g) throw new ApiError(404, "Gear not found.");
    await recordAudit(tx, { actorId: actor.id, action: "gear.update", targetType: "GearItem", targetId: id, meta: { fields: Object.keys(data), status: g.status } });
  });
  return NextResponse.json({ ok: true });
});
