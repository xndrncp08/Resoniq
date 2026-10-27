import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { addProjectMember, leaveProject } from "@/lib/messaging";
import { userIdForHandle } from "@/lib/handle-lookup";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { handle }: adds someone to a project (they must accept messages from you). */
export const POST = route<Ctx>("projects.add", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("invite", actor.id, RATE_LIMITS.invite);
  await addProjectMember(actor, (await params).id, await userIdForHandle((await readJson(req)).handle));
  return NextResponse.json({ ok: true }, { status: 201 });
});

/** Leave a project. */
export const DELETE = route<Ctx>("projects.leave", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await leaveProject(actor, (await params).id);
  return NextResponse.json({ ok: true });
});
