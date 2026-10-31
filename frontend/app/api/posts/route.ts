import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { attachMedia } from "@/lib/media/service";
import { createPost, parsePostInput, type PostAttachHook, type PostInput } from "@/lib/posts";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { assertCanPublish } from "@/lib/verification";
import { buildRelease, parseReleaseInput, releaseData } from "@/lib/publishing";
import { announceRelease, recordCredits } from "@/lib/credits";

/** Body: { title?, body?, category?, community?, toneId?, mediaIds?, release?: { canvasId?, takeId?, credits? } } */
export const POST = route("posts.create", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  await assertCanPublish(actor.id);
  const raw = await readJson(req, 64 * 1024);
  const input = parsePostInput(raw) as PostInput;
  const mediaIds = input.mediaIds ?? [];
  // Publishing music: permissions and credits are checked before anything is written.
  const release = raw.release !== undefined ? await buildRelease(actor.id, parseReleaseInput(raw.release)) : null;
  if (release && !input.title) input.title = release.title;
  // A release is original music by definition; this is what puts it on /music.
  if (release) input.category = "ORIGINAL";
  if (!input.body && !input.title && !mediaIds.length && !input.toneId) throw new ApiError(400, "Write something, attach media or share a tone.");

  const attach: PostAttachHook = async (tx, postId) => {
    if (input.toneId) {
      // Your own tones, or a public Resoniq-generated one to discuss. Attaching is sharing, so a private tone of yours becomes unlisted.
      const tone = await tx.tone.findFirst({
        where: { id: input.toneId, OR: [{ userId: actor.id }, { origin: "GENERATED", visibility: "PUBLIC" }] },
        select: { id: true, visibility: true },
      });
      if (!tone) throw new ApiError(404, "Tone not found.");
      if (tone.visibility === "PRIVATE") await tx.tone.update({ where: { id: tone.id }, data: { visibility: "UNLISTED" } });
      await tx.post.update({ where: { id: postId }, data: { toneId: tone.id } });
    }
    if (release) {
      await tx.post.update({ where: { id: postId }, data: releaseData(release) });
      await recordCredits(tx, postId, actor.id, release.credits);
    }
    // Posts with media still processing stay PROCESSING (author-only) until the worker finishes.
    return mediaIds.length ? attachMedia(tx, actor.id, postId, mediaIds) : undefined;
  };
  const post = await createPost(actor, input, { attach, requireContent: false });
  if (post.status === "PUBLISHED" && post.category === "ORIGINAL") await announceRelease(post.id);
  return NextResponse.json({ post }, { status: 201 });
});
