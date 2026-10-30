import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getProject, setProjectStage } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("projects.get", async (_req, { params }) => {
  const actor = await requireActor();
  return NextResponse.json({ project: await getProject(actor.id, (await params).id) });
});

/** Any member: { stage?, finished? } */
export const PATCH = route<Ctx>("projects.stage", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("message-write", actor.id, RATE_LIMITS.messageWrite);
  return NextResponse.json({ project: await setProjectStage(actor.id, (await params).id, await readJson(req)) });
});
