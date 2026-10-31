import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { optionalActor } from "@/lib/api";
import { listComments } from "@/lib/comments";
import { can } from "@/lib/permissions";
import { getPost, listPosts, type PostView } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { releaseFacts } from "@/lib/publishing";
import { Avatar, LinkButton } from "@/components/app/ui";
import ToggleButton from "@/components/social/ToggleButton";
import CommentThread from "@/components/social/CommentThread";
import PostCard from "@/components/social/PostCard";
import ModerationBar from "@/components/social/ModerationBar";
import { SeekProvider } from "@/components/media/seek";

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const viewer = await optionalActor();
  const staff = !!viewer && can(viewer.role, "content.moderate");
  return { viewer, staff, post: await getPost(id, viewer?.id ?? null, { staff }) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { post } = await load((await params).id);
  if (!post || post.status !== "PUBLISHED") return { title: "Post not found", robots: { index: false } };
  const artist = post.author.name ?? `@${post.author.handle}`;
  const title = post.title ?? `${artist} on Resoniq`;
  const images = [`/api/og/post/${post.id}`];
  if (post.release) {
    const facts = releaseFacts(post.release);
    const description = post.body.slice(0, 160) || [`Original music by ${artist}`, ...facts.chips, facts.credits && `With ${facts.credits}`].filter(Boolean).join(" · ");
    return {
      title: `${title} by ${artist}`,
      description,
      alternates: { canonical: `/p/${post.id}` },
      openGraph: { type: "music.song", title: `${title} by ${artist}`, description, images, url: `/p/${post.id}`, duration: post.release.takes[0]?.durationSec ? Math.round(post.release.takes[0].durationSec) : undefined, musicians: [`/u/${post.author.handle}`] },
    };
  }
  return { title, description: post.body.slice(0, 160) || undefined, openGraph: { title, images } };
}

/** schema.org MusicRecording, so search engines can show a release as music. Only confirmed credits are named. */
function releaseJsonLd(post: PostView) {
  const r = post.release!;
  const seconds = r.takes[0]?.durationSec;
  const abs = (path: string) => new URL(path, process.env.AUTH_URL ?? "http://localhost:3000").toString();
  const data = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: post.title ?? r.title,
    byArtist: { "@type": "Person", name: post.author.name ?? post.author.handle, url: abs(`/u/${post.author.handle}`) },
    url: abs(`/p/${post.id}`),
    datePublished: post.createdAt,
    ...(seconds && { duration: `PT${Math.floor(seconds / 60)}M${Math.round(seconds % 60)}S` }),
    ...(r.bpm && { tempo: r.bpm }),
    contributor: r.credits.filter((c) => c.status === "CONFIRMED" && c.userId !== post.author.id).map((c) => ({ "@type": "Person", name: c.name ?? c.handle, roleName: c.role })),
  };
  // `<` is escaped so text in a title can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const { viewer, staff, post } = await load(id);
  if (!post) notFound();
  const comments = post.status === "PUBLISHED" || post.viewer.isAuthor || staff ? await listComments(id, viewer?.id ?? null).catch(() => []) : [];
  const more = post.release && post.status === "PUBLISHED" ? await moreFromArtist(post, viewer?.id ?? null) : null;
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <LinkButton href="/feed" variant="ghost" size="sm" icon="chevron-left">Feed</LinkButton>
      {staff && <ModerationBar kind="post" id={post.id} status={post.status} />}
      {/* Timestamps in comments play the post's recording from that moment. */}
      <SeekProvider>
        <PostCard post={post} signedIn={!!viewer} detail voteMode={post.community ? "updown" : "amp"} />
        {more && (
          <aside aria-label={`More from ${post.author.name ?? post.author.handle}`} className="panel flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <Avatar user={post.author} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-body font-medium">{post.author.name ?? `@${post.author.handle}`}</p>
              {more.others.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-body text-sm">{more.others.map((p) => <li key={p.id}><Link href={`/p/${p.id}`} className="focus-ring rounded text-copper hover:underline">{p.title ?? "Untitled"}</Link></li>)}</ul>
              ) : <p className="font-body text-sm text-muted">This is their first release here.</p>}
            </div>
            {!post.viewer.isAuthor && (viewer ? <ToggleButton url={`/api/users/${post.author.handle}/follow`} initial={more.following} on="Following" off="Follow" signedIn size="sm" /> : <LinkButton href={`/signup?callbackUrl=${encodeURIComponent(`/p/${post.id}`)}`} variant="primary" size="sm">Join to follow</LinkButton>)}
            <LinkButton href={`/u/${post.author.handle}`} size="sm">Profile</LinkButton>
          </aside>
        )}
        <div className="panel p-4 sm:p-6">
          <CommentThread postId={post.id} initial={comments} signedIn={!!viewer} open={post.status === "PUBLISHED"} />
        </div>
      </SeekProvider>
      {post.release && post.status === "PUBLISHED" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: releaseJsonLd(post) }} />}
    </div>
  );
}

/** The artist's other releases (newest three the viewer can see) and whether the viewer follows them. */
async function moreFromArtist(post: PostView, viewerId: string | null) {
  const [others, follow] = await Promise.all([
    listPosts({ authorId: post.author.id, category: "ORIGINAL", id: { not: post.id } }, viewerId, { sort: "new", cursor: null, limit: 3 }),
    viewerId ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: post.author.id } }, select: { followerId: true } }) : null,
  ]);
  return { others: others.items, following: !!follow };
}
