import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { COMMUNITY_SELECT, isCommunityModerator, type CommunityRule } from "@/lib/communities";
import { can } from "@/lib/permissions";
import { listPosts, type FeedSort, type TopWindow } from "@/lib/posts";
import { AUTHOR_SELECT } from "@/lib/profiles";
import Icon from "@/components/icons/Icon";
import { Avatar, compact, EmptyState, LinkButton, Tabs } from "@/components/app/ui";
import PostFeed from "@/components/social/PostFeed";
import ToggleButton from "@/components/social/ToggleButton";
import Link from "next/link";
import { OPEN_TO_LABEL, isOpenTo } from "@/lib/portfolio-options";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; t?: string; view?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await prisma.community.findUnique({ where: { slug: (await params).slug }, select: { name: true, description: true } });
  return c ? { title: c.name, description: c.description } : { title: "Community not found" };
}

export default async function CommunityPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const viewer = await optionalActor();
  const c = await prisma.community.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { ...COMMUNITY_SELECT, members: { where: { role: "MODERATOR", user: { status: { not: "BANNED" } } }, select: { user: { select: AUTHOR_SELECT } }, take: 12 } },
  });
  if (!c) notFound();
  const unanswered = sp.view === "unanswered";
  const sort: FeedSort = unanswered ? "new" : sp.sort === "new" || sp.sort === "top" ? sp.sort : "hot";
  const window: TopWindow = (["day", "week", "month", "year", "all"] as const).find((w) => w === sp.t) ?? "week";
  const [page, joined, canMod, open] = await Promise.all([
    listPosts({ communityId: c.id }, viewer?.id ?? null, { sort, window, unanswered, cursor: null, limit: 15 }),
    viewer ? prisma.communityMember.findUnique({ where: { userId_communityId: { userId: viewer.id, communityId: c.id } } }) : null,
    viewer ? Promise.resolve(can(viewer.role, "content.moderate")).then(async (staff) => staff || (await isCommunityModerator(viewer.id, c.id))) : false,
    // Members who've said they're open to playing with others: this community's own directory.
    prisma.communityMember.findMany({
      where: { communityId: c.id, user: { status: "ACTIVE", kind: "PERSON", openTo: { isEmpty: false }, ...(viewer && { id: { not: viewer.id } }) } },
      orderBy: { joinedAt: "desc" },
      take: 6,
      select: { user: { select: { ...AUTHOR_SELECT, openTo: true, instruments: true } } },
    }),
  ]);
  const rules = (Array.isArray(c.rules) ? c.rules : []) as CommunityRule[];
  const about = (
    <>
      {rules.length > 0 && (
        <section className="panel p-4">
          <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="rules" size={14} /> Rules</h2>
          <ol className="space-y-3">
            {rules.map((r, i) => (
              <li key={i} className="font-body text-sm"><span className="font-semibold">{i + 1}. {r.title}</span>{r.body && <p className="mt-0.5 text-muted">{r.body}</p>}</li>
            ))}
          </ol>
        </section>
      )}
      <section className="panel p-4">
        <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="shield" size={14} /> Moderators</h2>
        {c.members.length ? (
          <ul className="space-y-2">{c.members.map(({ user }) => <li key={user.id}><Link href={`/u/${user.handle}`} className="flex items-center gap-2 font-body text-sm hover:underline"><Avatar user={user} size={28} /> {user.name ?? user.handle}</Link></li>)}</ul>
        ) : (
          <p className="font-body text-sm text-muted">Moderated by Resoniq staff.</p>
        )}
        {canMod && <p className="mt-3 font-mono text-[11px] text-amber">You can moderate here: open a post to remove or restore it.</p>}
      </section>
      {open.length > 0 && (
        <section className="panel p-4">
          <h2 className="label-engraved mb-3 flex items-center gap-2"><Icon name="users" size={14} /> Open to playing</h2>
          <ul className="space-y-2.5">
            {open.map(({ user }) => (
              <li key={user.id}>
                <Link href={`/u/${user.handle}`} className="focus-ring -mx-1 flex items-center gap-2.5 rounded-lg px-1 py-0.5 hover:bg-white/[0.04]">
                  <Avatar user={user} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate font-body text-sm">{user.name ?? user.handle}</span>
                    <span className="block truncate font-body text-xs text-signal">{user.openTo.filter(isOpenTo).slice(0, 2).map((o) => OPEN_TO_LABEL[o]).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <header className="panel grille relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-copper/10 blur-3xl" />
        <p className="label-engraved mb-2">c/{c.slug} · {c.kind.toLowerCase()}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-display-md font-semibold tracking-tight">{c.name}</h1>
            <p className="mt-2 font-body text-ink-dim">{c.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {!c.archivedAt && <ToggleButton url={`/api/communities/${c.slug}/membership`} initial={!!joined} on="Joined" off="Join" signedIn={!!viewer} />}
            {!c.archivedAt && <LinkButton href={`/new?community=${c.slug}`} icon="plus">Post</LinkButton>}
          </div>
        </div>
        <dl className="mt-6 flex gap-8 font-mono text-sm">
          <div><dt className="label-engraved">Members</dt><dd className="mt-1 text-xl text-ink">{compact(c.memberCount)}</dd></div>
          <div><dt className="label-engraved">Posts</dt><dd className="mt-1 text-xl text-ink">{compact(c.postCount)}</dd></div>
        </dl>
        {c.archivedAt && <p className="mt-4 font-body text-sm text-amber">This community is archived and read-only.</p>}
      </header>

      <div className="flex gap-8">
        <div className="min-w-0 flex-1 space-y-4">
          {/* Phones get the rules and moderators too, before the first post. */}
          <details className="panel group p-4 lg:hidden">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between rounded-lg font-body text-sm font-medium">About this community <Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" /></summary>
            <div className="mt-4 space-y-4 [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0 [&>section]:shadow-none">{about}</div>
          </details>
          <Tabs label="Sort" items={[
            ...(["hot", "new", "top"] as const).map((s) => ({ href: `/c/${c.slug}?sort=${s}`, label: s[0].toUpperCase() + s.slice(1), active: !unanswered && sort === s })),
            { href: `/c/${c.slug}?view=unanswered`, label: "Unanswered", active: unanswered },
          ]} />
          <PostFeed key={`${sort}-${window}-${unanswered}`} endpoint={`/api/communities/${c.slug}/posts?sort=${sort}&t=${window}&limit=15${unanswered ? "&unanswered=1" : ""}`} initial={page.items} cursor={page.nextCursor} signedIn={!!viewer} voteMode="updown" empty={unanswered ? <EmptyState icon="check" title="Every question has an answer">Ask one of your own, or browse what people are talking about.</EmptyState> : <EmptyState icon="community" title="No posts yet" action={<LinkButton href={`/new?community=${c.slug}`} variant="primary">Start the first thread</LinkButton>} />} />
        </div>
        <aside className="hidden w-[300px] shrink-0 space-y-4 lg:block">{about}</aside>
      </div>
    </div>
  );
}
