import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { optionalActor } from "@/lib/api";
import { getPublicProfile } from "@/lib/profiles";
import { listPosts } from "@/lib/posts";
import { listedToneWhere, listTones, savedTones } from "@/lib/tones";
import { INSTRUMENT_LABEL, type Instrument } from "@/lib/instruments";
import { musicianDirectoryHref } from "@/lib/musician-directory";
import Icon from "@/components/icons/Icon";
import { Avatar, Chip, compact, EmptyState, LinkButton, ManagedCreatorBadge, Tabs } from "@/components/app/ui";
import RichText from "@/components/app/RichText";
import PostFeed from "@/components/social/PostFeed";
import ToggleButton from "@/components/social/ToggleButton";
import ToneGrid from "@/components/tone/ToneGrid";
import ProfileMenu from "@/components/social/ProfileMenu";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string }> };

const load = cache(async (handle: string) => {
  const viewer = await optionalActor();
  return { viewer, profile: await getPublicProfile(handle, viewer?.id ?? null) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile } = await load((await params).handle);
  return profile ? { title: `${profile.name ?? `@${profile.handle}`} (@${profile.handle})`, description: profile.bio ?? undefined } : { title: "Musician not found" };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  const { viewer, profile } = await load(handle);
  if (!profile) notFound();
  const tab = sp.tab === "tones" || (sp.tab === "saved" && profile.isSelf) ? sp.tab : "posts";
  const vid = viewer?.id ?? null;

  return (
    <div className="space-y-6">
      <header className="panel overflow-hidden">
        <div className="grille relative h-36 bg-gradient-to-br from-copper-deep/60 via-surface to-signal-dim/30 sm:h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.bannerUrl && <img src={profile.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-16">
            <Avatar user={profile} size={112} className="ring-4 ring-bg" />
            <div className="flex items-center gap-2 pb-1">
              {profile.isSelf ? (
                <LinkButton href="/settings" icon="edit">Edit profile</LinkButton>
              ) : (
                <ToggleButton url={`/api/users/${profile.handle}/follow`} initial={profile.viewerFollows} on="Following" off="Follow" signedIn={!!viewer} />
              )}
              {!profile.isSelf && viewer && <ProfileMenu userId={profile.id} />}
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{profile.name ?? `@${profile.handle}`}</h1>
          <p className="font-mono text-sm text-muted">@{profile.handle}</p>
          {profile.managed && <ManagedCreatorBadge />}
          {profile.bio && <RichText text={profile.bio} className="mt-3 max-w-2xl font-body text-[15px] leading-relaxed text-ink-dim" />}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.instruments.map((i) => <Link key={i} href={musicianDirectoryHref({ instrument: i as Instrument })} className="focus-ring rounded-full" aria-label={`Find musicians: ${INSTRUMENT_LABEL[i as Instrument] ?? i}`}><Chip icon={i === "bass" ? "bass" : i.includes("guitar") || i === "extended-range" ? "guitar" : "audio"}>{INSTRUMENT_LABEL[i as Instrument] ?? i}</Chip></Link>)}
            {profile.genres.map((g) => <Link key={g} href={musicianDirectoryHref({ genre: g })} className="focus-ring rounded-full" aria-label={`Find musicians playing ${g}`}><Chip>{g}</Chip></Link>)}
          </div>
          {profile.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-body text-sm">
              {profile.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-1 text-copper hover:underline"><Icon name="external" size={14} /> {l.label}</a>
              ))}
            </div>
          )}
          <dl className="mt-5 flex flex-wrap gap-6 font-mono text-sm">
            <Link href={`/u/${profile.handle}/followers`} className="hover:text-copper"><dt className="label-engraved">Followers</dt><dd className="text-lg text-ink">{compact(profile.followerCount)}</dd></Link>
            <Link href={`/u/${profile.handle}/following`} className="hover:text-copper"><dt className="label-engraved">Following</dt><dd className="text-lg text-ink">{compact(profile.followingCount)}</dd></Link>
            <div title="Net votes on their posts and comments"><dt className="label-engraved">Reputation</dt><dd className="text-lg text-ink">{compact(profile.reputation)}</dd></div>
          </dl>
        </div>
      </header>

      <Tabs label="Profile" items={[
        { href: `/u/${profile.handle}`, label: "Posts", active: tab === "posts" },
        { href: `/u/${profile.handle}?tab=tones`, label: "Tones", active: tab === "tones" },
        ...(profile.isSelf ? [{ href: `/u/${profile.handle}?tab=saved`, label: "Saved tones", active: tab === "saved" }] : []),
      ]} />

      {tab === "posts" && <ProfilePosts profileId={profile.id} handle={profile.handle} viewerId={vid} />}
      {tab === "tones" && <ProfileTones profileId={profile.id} handle={profile.handle} viewerId={vid} isSelf={profile.isSelf} />}
      {tab === "saved" && <SavedTones profileId={profile.id} />}
    </div>
  );
}

async function ProfilePosts({ profileId, handle, viewerId }: { profileId: string; handle: string; viewerId: string | null }) {
  const page = await listPosts({ authorId: profileId }, viewerId, { sort: "new", cursor: null, limit: 12 });
  return (
    <div className="mx-auto max-w-[680px]">
      <PostFeed endpoint={`/api/users/${handle}/posts?sort=new&limit=12`} initial={page.items} cursor={page.nextCursor} signedIn={!!viewerId} empty={<EmptyState icon="feed" title="No posts yet" />} />
    </div>
  );
}

async function ProfileTones({ profileId, handle, viewerId, isSelf }: { profileId: string; handle: string; viewerId: string | null; isSelf: boolean }) {
  const page = await listTones(viewerId, { sort: "new", authorId: profileId, cursor: null, limit: 18 }, isSelf ? { userId: profileId } : listedToneWhere);
  return <ToneGrid endpoint={`/api/users/${handle}/tones?limit=18`} initial={page.items} cursor={page.nextCursor} empty={<EmptyState icon="tone" title="No public tones yet" />} />;
}

async function SavedTones({ profileId }: { profileId: string }) {
  const page = await savedTones(profileId, null, 18);
  return <ToneGrid endpoint="/api/tones/saved?limit=18" initial={page.items} cursor={page.nextCursor} empty={<EmptyState icon="bookmark" title="Nothing saved yet" action={<LinkButton href="/tones">Browse tones</LinkButton>} />} />;
}
