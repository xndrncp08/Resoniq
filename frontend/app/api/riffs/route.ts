import { NextResponse } from "next/server";
import type { RiffStage } from "@prisma/client";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createRiff, listRiffs, parseRiffPatch, RIFF_STAGES } from "@/lib/riffs/service";

/** ?q=&tag=&stage=&project= : your riffs and riffs shared with you through projects. */
export const GET = route("riffs.list", async (req) => {
  const actor = await requireActor();
  const p = new URL(req.url).searchParams;
  const stage = p.get("stage") as RiffStage | null;
  return NextResponse.json({ riffs: await listRiffs(actor.id, { q: p.get("q")?.slice(0, 80) || undefined, tag: p.get("tag")?.slice(0, 24) || undefined, stage: stage && RIFF_STAGES.includes(stage) ? stage : undefined, projectId: /^[a-z0-9]{10,40}$/.test(p.get("project") ?? "") ? p.get("project")! : undefined }) });
});

export const POST = route("riffs.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("riff-write", actor.id, RATE_LIMITS.riffWrite);
  return NextResponse.json({ riff: await createRiff(actor.id, parseRiffPatch(await readJson(req), { create: true })) }, { status: 201 });
});
