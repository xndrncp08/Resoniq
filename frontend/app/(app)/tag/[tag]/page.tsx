import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { optionalActor } from "@/lib/api";
import { listPosts, type FeedSort } from "@/lib/posts";
import { normalizeTag, TAG_PATTERN } from "@/lib/rich-text";
import { EmptyState, PageHeader, Tabs } from "@/components/app/ui";
import PostFeed from "@/components/social/PostFeed";

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `#${normalizeTag(decodeURIComponent((await params).tag))}` };
}

export default async function TagPage({ params, searchParams }: Props) {
  const [{ tag: raw }, sp] = await Promise.all([params, searchParams]);
  const tag = normalizeTag(decodeURIComponent(raw));
  if (!TAG_PATTERN.test(tag)) notFound();
  const sort: FeedSort = sp.sort === "new" || sp.sort === "top" ? sp.sort : "hot";
  const viewer = await optionalActor();
  const page = await listPosts({ tags: { some: { tag } } }, viewer?.id ?? null, { sort, window: "all", cursor: null, limit: 15 });
  return (
    <div className="mx-auto max-w-[680px] space-y-4">
      <PageHeader eyebrow="Tag" title={<span className="text-signal">#{tag}</span>} />
      <Tabs label="Sort" items={(["hot", "new", "top"] as const).map((s) => ({ href: `/tag/${tag}?sort=${s}`, label: s[0].toUpperCase() + s.slice(1), active: sort === s }))} />
      <PostFeed key={sort} endpoint={`/api/tags/${tag}/posts?sort=${sort}&t=all&limit=15`} initial={page.items} cursor={page.nextCursor} signedIn={!!viewer} empty={<EmptyState icon="hashtag" title={`Nothing tagged #${tag} yet`} />} />
    </div>
  );
}
