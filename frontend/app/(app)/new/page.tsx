import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { mediaCapabilities } from "@/lib/hosting";
import { PageHeader } from "@/components/app/ui";
import Composer from "@/components/social/Composer";

export const metadata: Metadata = { title: "Share" };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ category?: string; community?: string; tone?: string }> }) {
  const sp = await searchParams;
  const actor = await requirePageActor("/new");
  const [communities, joined, tones] = await Promise.all([
    prisma.community.findMany({ where: { archivedAt: null }, orderBy: [{ memberCount: "desc" }, { name: "asc" }], take: 200, select: { id: true, slug: true, name: true } }),
    prisma.communityMember.findMany({ where: { userId: actor.id }, select: { communityId: true } }),
    prisma.tone.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true, visibility: true } }),
  ]);
  const caps = await mediaCapabilities();
  const mine = new Set(joined.map((j) => j.communityId));
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader eyebrow="New post" title="Share something you played" />
      <Composer communities={communities.map((c) => ({ slug: c.slug, name: c.name, joined: mine.has(c.id) }))} tones={tones} uploadKinds={{ images: caps.images, video: caps.video, audio: caps.audio, note: caps.note }} initial={{ category: sp.category, community: sp.community, toneId: tones.some((t) => t.id === sp.tone) ? sp.tone : undefined }} />
    </div>
  );
}
