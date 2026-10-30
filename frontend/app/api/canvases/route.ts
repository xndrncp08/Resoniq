import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createCanvas, listCanvases } from "@/lib/canvas/service";

/** ?project=<id>: your songs and songs in your projects. */
export const GET = route("canvases.list", async (req) => {
  const actor = await requireActor();
  const project = new URL(req.url).searchParams.get("project");
  return NextResponse.json({ canvases: await listCanvases(actor.id, { projectId: project && /^[a-z0-9]{10,40}$/.test(project) ? project : undefined }) });
});

/** Body: { title?, projectId?, fromRiffId? } */
export const POST = route("canvases.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("canvas-write", actor.id, RATE_LIMITS.canvasWrite);
  return NextResponse.json({ canvas: await createCanvas(actor.id, await readJson(req)) }, { status: 201 });
});
