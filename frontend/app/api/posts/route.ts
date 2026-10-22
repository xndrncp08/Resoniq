import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { createPost, parsePostInput, type PostAttachHook, type PostInput } from "@/lib/posts";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const POST = route("posts.create", async (req) => {
  const actor = await requireActor({ write: true });
  enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  const input = parsePostInput(await readJson(req, 64 * 1024)) as PostInput;
  const attach: PostAttachHook | undefined = input.toneId
    ? async (tx, postId) => {
        // Only your own tones can be attached. Attaching is sharing, so a private tone becomes unlisted.
        const tone = await tx.tone.findFirst({ where: { id: input.toneId!, userId: actor.id }, select: { id: true, visibility: true } });
        if (!tone) throw new ApiError(404, "Tone not found.");
        if (tone.visibility === "PRIVATE") await tx.tone.update({ where: { id: tone.id }, data: { visibility: "UNLISTED" } });
        await tx.post.update({ where: { id: postId }, data: { toneId: tone.id } });
      }
    : undefined;
  const post = await createPost(actor, input, { attach });
  return NextResponse.json({ post }, { status: 201 });
});
