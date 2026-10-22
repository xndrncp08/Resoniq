import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { attachMedia } from "@/lib/media/service";
import { createPost, parsePostInput, type PostAttachHook, type PostInput } from "@/lib/posts";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { assertCanPublish } from "@/lib/verification";

/** Body: { title?, body?, category?, community?, toneId?, mediaIds? } */
export const POST = route("posts.create", async (req) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  await assertCanPublish(actor.id);
  const input = parsePostInput(await readJson(req, 64 * 1024)) as PostInput;
  const mediaIds = input.mediaIds ?? [];
  if (!input.body && !input.title && !mediaIds.length && !input.toneId) throw new ApiError(400, "Write something, attach media or share a tone.");

  const attach: PostAttachHook = async (tx, postId) => {
    if (input.toneId) {
      // Only your own tones can be attached. Attaching is sharing, so a private tone becomes unlisted.
      const tone = await tx.tone.findFirst({ where: { id: input.toneId, userId: actor.id }, select: { id: true, visibility: true } });
      if (!tone) throw new ApiError(404, "Tone not found.");
      if (tone.visibility === "PRIVATE") await tx.tone.update({ where: { id: tone.id }, data: { visibility: "UNLISTED" } });
      await tx.post.update({ where: { id: postId }, data: { toneId: tone.id } });
    }
    // Posts with media still processing stay PROCESSING (author-only) until the worker finishes.
    return mediaIds.length ? attachMedia(tx, actor.id, postId, mediaIds) : undefined;
  };
  const post = await createPost(actor, input, { attach, requireContent: false });
  return NextResponse.json({ post }, { status: 201 });
});
