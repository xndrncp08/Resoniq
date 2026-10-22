import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { completeUpload, toMediaView } from "@/lib/media/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>("media.complete", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  const media = await completeUpload(actor, (await params).id);
  return NextResponse.json({ media: toMediaView(media, actor.id) });
});
