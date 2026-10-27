import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { answerInvite } from "@/lib/messaging";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { accept: boolean }. Accepting starts a project with both of you. */
export const POST = route<Ctx>("invites.answer", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  const { accept } = await readJson(req);
  return NextResponse.json(await answerInvite(actor, (await params).id, accept === true));
});
