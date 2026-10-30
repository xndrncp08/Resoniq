import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deleteTake, renameTake } from "@/lib/riffs/service";
import { fail } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>("riff-takes.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("riff-write", actor.id, RATE_LIMITS.riffWrite);
  const { label } = await readJson(req);
  if (label !== null && (typeof label !== "string" || label.trim().length > 80)) fail("Take labels are at most 80 characters.");
  await renameTake(actor.id, (await params).id, typeof label === "string" ? label.trim() || null : null);
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Ctx>("riff-takes.delete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("riff-write", actor.id, RATE_LIMITS.riffWrite);
  await deleteTake(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
