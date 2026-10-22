import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { ownUpload, removeMedia, toMediaView } from "@/lib/media/service";

type Ctx = { params: Promise<{ id: string }> };

/** Owner status polling while the worker processes an upload. */
export const GET = route<Ctx>("media.get", async (_req, { params }) => {
  const actor = await requireActor();
  return NextResponse.json({ media: toMediaView(await ownUpload(actor, (await params).id), actor.id) });
});

export const DELETE = route<Ctx>("media.delete", async (_req, { params }) => {
  const actor = await requireActor();
  await removeMedia(actor, (await params).id, "Deleted by owner", { asModerator: false });
  return NextResponse.json({ ok: true });
});
