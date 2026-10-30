import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createRoom, listRooms } from "@/lib/rooms/service";
import { fail } from "@/lib/validation";

/** ?project=<id>: the project's open rooms. */
export const GET = route("rooms.list", async (req) => {
  const actor = await requireActor();
  const project = new URL(req.url).searchParams.get("project");
  if (!project || !/^[a-z0-9]{10,40}$/.test(project)) fail("project is required.");
  return NextResponse.json({ rooms: await listRooms(actor.id, project) });
});

/** Body: { projectId, title?, takeId? } */
export const POST = route("rooms.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("room-write", actor.id, RATE_LIMITS.roomWrite);
  return NextResponse.json({ id: await createRoom(actor.id, await readJson(req)) }, { status: 201 });
});
