import type { Metadata } from "next";
import Link from "next/link";
import type { CommunityKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { COMMUNITY_KINDS, COMMUNITY_SELECT } from "@/lib/communities";
import Icon, { type IconName } from "@/components/icons/Icon";
import { compact, LinkButton, PageHeader, Tabs } from "@/components/app/ui";

export const metadata: Metadata = { title: "Communities" };

const KIND_ICON: Record<CommunityKind, IconName> = { GENRE: "audio", INSTRUMENT: "guitar", GEAR: "pedal", STYLE: "knob", TOPIC: "comment" };
const KIND_LABEL: Record<CommunityKind, string> = { GENRE: "Genres", INSTRUMENT: "Instruments", GEAR: "Gear", STYLE: "Styles", TOPIC: "Topics" };

export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string }> }) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const kind = COMMUNITY_KINDS.find((k) => k === sp.kind);
  const q = sp.q?.trim().slice(0, 60);
  const [communities, joined] = await Promise.all([
    prisma.community.findMany({
      where: { archivedAt: null, ...(kind && { kind }), ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] }) },
      orderBy: [{ memberCount: "desc" }, { postCount: "desc" }, { name: "asc" }],
      take: 120,
      select: COMMUNITY_SELECT,
    }),
    viewer ? prisma.communityMember.findMany({ where: { userId: viewer.id }, select: { communityId: true } }) : [],
  ]);
  const mine = new Set(joined.map((j) => j.communityId));

  return (
    <div>
      <PageHeader eyebrow="Communities" title="Find your people" actions={<LinkButton href="/c/new" icon="plus">Start a community</LinkButton>}>
        Spaces for genres, instruments, gear and the way you play.
      </PageHeader>
      <form className="mb-4" action="/c">
        <label className="sr-only" htmlFor="cq">Search communities</label>
        <input id="cq" name="q" defaultValue={q} placeholder="Search communities" className="panel-inset h-11 w-full max-w-md rounded-full px-4 font-body outline-none focus:border-copper/60" />
      </form>
      <Tabs label="Community type" className="mb-6" items={[{ href: "/c", label: "All", active: !kind }, ...COMMUNITY_KINDS.map((k) => ({ href: `/c?kind=${k}`, label: KIND_LABEL[k], active: kind === k }))]} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {communities.map((c) => (
          <li key={c.id}>
            <Link href={`/c/${c.slug}`} className="focus-ring panel group flex h-full gap-4 p-4 transition-colors hover:border-copper/40">
              <span className="panel-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-copper"><Icon name={KIND_ICON[c.kind]} size={24} /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-display text-lg font-semibold">{c.name} {mine.has(c.id) && <Icon name="check" size={16} className="text-signal" />}</span>
                <span className="block font-mono text-xs text-muted">c/{c.slug} · {compact(c.memberCount)} members · {compact(c.postCount)} posts</span>
                <span className="mt-1.5 line-clamp-2 block font-body text-sm text-ink-dim">{c.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!communities.length && <p className="font-body text-muted">No communities match.</p>}
    </div>
  );
}
