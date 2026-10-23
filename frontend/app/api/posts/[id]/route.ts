import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, optionalActor, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { deletePost, editPost, getPost, parsePostInput } from "@/lib/posts";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("posts.get", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const post = await getPost((await params).id, viewer?.id ?? null, { staff: !!viewer && can(viewer.role, "content.moderate") });
  if (!post) throw new ApiError(404, "Post not found.");
  return NextResponse.json({ post });
});

export const PATCH = route<Ctx>("posts.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  const patch = parsePostInput(await readJson(req, 64 * 1024), { partial: true });
  return NextResponse.json({ post: await editPost(actor, (await params).id, patch) });
});

export const DELETE = route<Ctx>("posts.delete", async (_req, { params }) => {
  const actor = await requireActor();
  await deletePost(actor, (await params).id);
  return NextResponse.json({ ok: true });
});
