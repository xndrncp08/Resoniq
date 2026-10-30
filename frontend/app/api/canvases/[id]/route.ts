import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deleteCanvas, getCanvas, parseContent, saveCanvas, setCanvasProject } from "@/lib/canvas/service";
import { fail } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("canvases.get", async (_req, { params }) => {
  const actor = await requireActor();
  const canvas = await getCanvas(actor.id, (await params).id);
  if (!canvas) throw new ApiError(404, "Song not found.");
  return NextResponse.json({ canvas });
});

/** Body: { baseVersion, title, key, bpm, sections, arrangement }. 409 when someone saved since baseVersion. */
export const PUT = route<Ctx>("canvases.save", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("canvas-write", actor.id, RATE_LIMITS.canvasWrite);
  const body = await readJson(req, 256 * 1024);
  if (typeof body.baseVersion !== "number" || !Number.isInteger(body.baseVersion)) fail("baseVersion is required.");
  return NextResponse.json({ canvas: await saveCanvas(actor.id, (await params).id, body.baseVersion, parseContent(body)) });
});

/** Owner: { projectId: string | null } moves the song into a project or back to private. */
export const PATCH = route<Ctx>("canvases.project", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("canvas-write", actor.id, RATE_LIMITS.canvasWrite);
  const { projectId } = await readJson(req);
  if (projectId !== null && (typeof projectId !== "string" || !/^[a-z0-9]{10,40}$/.test(projectId))) fail("projectId is invalid.");
  return NextResponse.json({ canvas: await setCanvasProject(actor.id, (await params).id, projectId as string | null) });
});

export const DELETE = route<Ctx>("canvases.delete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await deleteCanvas(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
