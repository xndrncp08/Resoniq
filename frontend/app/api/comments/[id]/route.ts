import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { deleteComment, editComment, parseCommentBody } from "@/lib/comments";
import { RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>("comments.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("comment-write", actor.id, RATE_LIMITS.commentWrite);
  const { body } = await readJson(req, 32 * 1024);
  return NextResponse.json({ comment: await editComment(actor, (await params).id, parseCommentBody(body)) });
});

export const DELETE = route<Ctx>("comments.delete", async (_req, { params }) => {
  const actor = await requireActor();
  await deleteComment(actor, (await params).id);
  return NextResponse.json({ ok: true });
});
