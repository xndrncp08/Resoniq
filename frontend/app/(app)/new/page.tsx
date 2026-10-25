import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { mediaCapabilities } from "@/lib/hosting";
import { PageHeader } from "@/components/app/ui";
import Composer from "@/components/social/Composer";
import { postPrompt } from "@/lib/post-prompts";

export const metadata: Metadata = { title: "Share" };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ category?: string; community?: string; tone?: string; prompt?: string }> }) {
  const sp = await searchParams;
  const prompt = postPrompt(sp.prompt);
  const returnQuery = new URLSearchParams(Object.entries(sp).filter(([key, value]) => ["category", "community", "tone", "prompt"].includes(key) && typeof value === "string" && value.length <= 200));
  const actor = await requirePageActor(`/new${returnQuery.size ? `?${returnQuery}` : ""}`);
  const [communities, joined, tones] = await Promise.all([
    prisma.community.findMany({ where: { archivedAt: null }, orderBy: [{ memberCount: "desc" }, { name: "asc" }], take: 200, select: { id: true, slug: true, name: true } }),
    prisma.communityMember.findMany({ where: { userId: actor.id }, select: { communityId: true } }),
    prisma.tone.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true, visibility: true } }),
  ]);
  // "Discuss this tone" on a Resoniq-generated tone pre-attaches it (app/api/posts allows those).
  if (sp.tone && !tones.some((t) => t.id === sp.tone)) {
    const generated = await prisma.tone.findFirst({ where: { id: sp.tone, origin: "GENERATED", visibility: "PUBLIC" }, select: { id: true, name: true, visibility: true } });
    if (generated) tones.unshift({ ...generated, name: `${generated.name} (Resoniq-generated)` });
  }
  const caps = await mediaCapabilities();
  const mine = new Set(joined.map((j) => j.communityId));
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader eyebrow="New post" title={prompt?.label ?? "Let people into your music"}>A work in progress, a question, a finished take. You do not need a perfect performance or a particular rig to belong here.</PageHeader>
      <Composer communities={communities.map((c) => ({ slug: c.slug, name: c.name, joined: mine.has(c.id) }))} tones={tones} uploadKinds={{ images: caps.images, video: caps.video, audio: caps.audio, note: caps.note }} initial={{ category: sp.category ?? prompt?.category, community: sp.community, toneId: tones.some((t) => t.id === sp.tone) ? sp.tone : undefined, title: prompt?.title, body: prompt?.body }} />
    </div>
  );
}
