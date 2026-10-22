import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { optionalActor } from "@/lib/api";
import { listComments } from "@/lib/comments";
import { can } from "@/lib/permissions";
import { getPost } from "@/lib/posts";
import { LinkButton } from "@/components/app/ui";
import CommentThread from "@/components/social/CommentThread";
import PostCard from "@/components/social/PostCard";
import ModerationBar from "@/components/social/ModerationBar";

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const viewer = await optionalActor();
  const staff = !!viewer && can(viewer.role, "content.moderate");
  return { viewer, staff, post: await getPost(id, viewer?.id ?? null, { staff }) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { post } = await load((await params).id);
  if (!post || post.status !== "PUBLISHED") return { title: "Post not found", robots: { index: false } };
  const title = post.title ?? `${post.author.name ?? `@${post.author.handle}`} on Resoniq`;
  return { title, description: post.body.slice(0, 160) || undefined, openGraph: { title, images: [`/api/og/post/${post.id}`] } };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const { viewer, staff, post } = await load(id);
  if (!post) notFound();
  const comments = post.status === "PUBLISHED" || post.viewer.isAuthor || staff ? await listComments(id, viewer?.id ?? null).catch(() => []) : [];
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <LinkButton href="/feed" variant="ghost" size="sm" icon="chevron-left">Feed</LinkButton>
      {staff && <ModerationBar kind="post" id={post.id} status={post.status} />}
      <PostCard post={post} signedIn={!!viewer} detail voteMode={post.community ? "updown" : "amp"} />
      <div className="panel p-4 sm:p-6">
        <CommentThread postId={post.id} initial={comments} signedIn={!!viewer} open={post.status === "PUBLISHED"} />
      </div>
    </div>
  );
}
