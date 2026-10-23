import { NextResponse } from "next/server";
import { enforceRateLimit, optionalActor, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { createComment, listComments, parseCommentBody } from "@/lib/comments";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("comments.list", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  return NextResponse.json({ items: await listComments((await params).id, viewer?.id ?? null) });
});

export const POST = route<Ctx>("comments.create", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("comment-write", actor.id, RATE_LIMITS.commentWrite);
  const body = await readJson(req, 32 * 1024);
  const comment = await createComment(actor, (await params).id, {
    body: parseCommentBody(body.body),
    parentId: typeof body.parentId === "string" ? body.parentId : null,
  });
  return NextResponse.json({ comment }, { status: 201 });
});
