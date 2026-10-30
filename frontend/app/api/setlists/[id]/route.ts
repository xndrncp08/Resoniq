import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deleteSetlist, getSetlist, parseSetlistPatch, updateSetlist } from "@/lib/setlists";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("setlists.get", async (_req, { params }) => {
  const actor = await requireActor();
  const setlist = await getSetlist(actor.id, (await params).id);
  if (!setlist) throw new ApiError(404, "Setlist not found.");
  return NextResponse.json({ setlist });
});

export const PATCH = route<Ctx>("setlists.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("setlist-write", actor.id, RATE_LIMITS.setlistWrite);
  return NextResponse.json({ setlist: await updateSetlist(actor.id, (await params).id, parseSetlistPatch(await readJson(req, 128 * 1024))) });
});

export const DELETE = route<Ctx>("setlists.delete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("setlist-write", actor.id, RATE_LIMITS.setlistWrite);
  await deleteSetlist(actor.id, (await params).id);
  return NextResponse.json({ ok: true });
});
