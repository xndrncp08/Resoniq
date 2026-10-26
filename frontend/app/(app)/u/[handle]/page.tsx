import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { optionalActor } from "@/lib/api";
import { getPublicProfile } from "@/lib/profiles";
import { listPosts, PERFORMANCE_WHERE } from "@/lib/posts";
import { getShowcase, type Showcase } from "@/lib/portfolio";
import { OPEN_TO_LABEL } from "@/lib/portfolio-options";
import { patchFromTone } from "@/lib/studio/from-tone";
import { KIND_ICON } from "@/components/tone/gear-icons";
import PostCard from "@/components/social/PostCard";
import SignatureRig from "@/components/social/SignatureRig";
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
  const profile = await getPublicProfile(handle, viewer?.id ?? null);
  return { viewer, profile, showcase: profile ? await getShowcase(profile.id, viewer?.id ?? null) : null };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile } = await load((await params).handle);
  return profile ? { title: `${profile.name ?? `@${profile.handle}`} (@${profile.handle})`, description: profile.bio ?? undefined } : { title: "Musician not found" };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  const { viewer, profile, showcase } = await load(handle);
  if (!profile || !showcase) notFound();
  const tab = sp.tab === "tones" || sp.tab === "performances" || (sp.tab === "saved" && profile.isSelf) ? sp.tab : "posts";
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
          <p className="flex flex-wrap items-center gap-x-3 font-mono text-sm text-muted">
            <span>@{profile.handle}</span>
            {profile.location && <span className="inline-flex items-center gap-1 font-body"><Icon name="globe" size={14} /> {profile.location}</span>}
          </p>
          {profile.openTo.length > 0 && (
            <ul aria-label="Open to" className="mt-3 flex flex-wrap gap-1.5">
              {profile.openTo.map((o) => (
                <li key={o}><Link href={musicianDirectoryHref({ open: o })} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-signal/10 px-3 py-1 font-body text-xs text-ink hover:border-signal"><span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />Open to {OPEN_TO_LABEL[o].toLowerCase()}</Link></li>
              ))}
            </ul>
          )}
          {profile.managed && <ManagedCreatorBadge />}
          {profile.bio && <RichText text={profile.bio} className="mt-3 max-w-2xl font-body text-[15px] leading-relaxed text-ink-dim" />}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.instruments.map((i) => <Link key={i} href={musicianDirectoryHref({ instrument: i as Instrument })} className="focus-ring rounded-full" aria-label={`Find musicians: ${INSTRUMENT_LABEL[i as Instrument] ?? i}`}><Chip icon={i === "bass" ? "bass" : i.includes("guitar") || i === "extended-range" ? "guitar" : "audio"}>{INSTRUMENT_LABEL[i as Instrument] ?? i}</Chip></Link>)}
            {profile.genres.map((g) => <Link key={g} href={musicianDirectoryHref({ genre: g })} className="focus-ring rounded-full" aria-label={`Find musicians playing ${g}`}><Chip>{g}</Chip></Link>)}
          </div>
          {profile.influences.length > 0 && (
            <p className="mt-3 max-w-2xl font-body text-sm text-muted"><span className="label-engraved mr-2">Influences</span>{profile.influences.join(" · ")}</p>
          )}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <aside aria-label="Showcase" className="space-y-4 lg:sticky lg:top-6 lg:order-2">
          {showcase.signatureTone && <SignatureRig tone={{ id: showcase.signatureTone.id, name: showcase.signatureTone.name }} {...pick(patchFromTone(showcase.signatureTone))} />}
          {showcase.rig.length > 0 && <RigList rig={showcase.rig} />}
          {profile.isSelf && <Strength profile={profile} showcase={showcase} />}
        </aside>
        <div className="min-w-0 space-y-4 lg:order-1">
          <Tabs label="Profile" items={[
            { href: `/u/${profile.handle}`, label: "Posts", active: tab === "posts" },
            { href: `/u/${profile.handle}?tab=performances`, label: "Performances", active: tab === "performances" },
            { href: `/u/${profile.handle}?tab=tones`, label: "Tones", active: tab === "tones" },
            ...(profile.isSelf ? [{ href: `/u/${profile.handle}?tab=saved`, label: "Saved tones", active: tab === "saved" }] : []),
          ]} />
          {tab === "posts" && (
            <>
              {showcase.pinnedPost && (
                <div>
                  <p className="label-engraved mb-2 flex items-center gap-1.5 text-copper"><Icon name="spotlight" size={14} /> Pinned</p>
                  <PostCard post={showcase.pinnedPost} signedIn={!!viewer} />
                </div>
              )}
              <ProfilePosts profileId={profile.id} handle={profile.handle} viewerId={vid} exclude={showcase.pinnedPost?.id} />
            </>
          )}
          {tab === "performances" && <ProfilePosts profileId={profile.id} handle={profile.handle} viewerId={vid} performances />}
          {tab === "tones" && <ProfileTones profileId={profile.id} handle={profile.handle} viewerId={vid} isSelf={profile.isSelf} />}
          {tab === "saved" && <SavedTones profileId={profile.id} />}
        </div>
      </div>
    </div>
  );
}

const pick = ({ patch, from }: ReturnType<typeof patchFromTone>) => ({ patch, from });

async function ProfilePosts({ profileId, handle, viewerId, performances = false, exclude }: { profileId: string; handle: string; viewerId: string | null; performances?: boolean; exclude?: string }) {
  // The pinned post is shown above the timeline, so it isn't repeated in it.
  const page = await listPosts({ authorId: profileId, ...(performances && PERFORMANCE_WHERE), ...(exclude && { id: { not: exclude } }) }, viewerId, { sort: "new", cursor: null, limit: 12 });
  return (
    <PostFeed
      endpoint={`/api/users/${handle}/posts?sort=new&limit=12${performances ? "&kind=performances" : ""}${exclude ? `&exclude=${exclude}` : ""}`}
      initial={page.items}
      cursor={page.nextCursor}
      signedIn={!!viewerId}
      empty={<EmptyState icon={performances ? "video" : "feed"} title={performances ? "No performances yet" : "No posts yet"} />}
    />
  );
}

/** The gear they play, grouped the way it sits in a signal path. */
function RigList({ rig }: { rig: Showcase["rig"] }) {
  return (
    <section aria-labelledby="rig-h" className="panel p-4 sm:p-5">
      <h2 id="rig-h" className="label-engraved mb-3">The rig</h2>
      <ul className="space-y-1">
        {rig.map(({ gear, note }) => (
          <li key={gear.id}>
            <Link href={`/gear/${gear.slug}`} className="focus-ring -mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
              <Icon name={KIND_ICON[gear.kind]} size={18} className="mt-0.5 shrink-0 text-copper" />
              <span className="min-w-0">
                <span className="block truncate font-body text-sm font-medium">{gear.brand} {gear.model}</span>
                {note && <span className="block truncate font-body text-xs text-muted">{note}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** For the owner only: what's still missing, each with a link to fix it. */
function Strength({ profile, showcase }: { profile: { bio: string | null; instruments: string[]; genres: string[]; openTo: string[] }; showcase: Showcase }) {
  const steps = [
    { done: profile.instruments.length > 0 && profile.genres.length > 0, label: "Add your instruments and genres" },
    { done: !!profile.bio, label: "Write a short bio" },
    { done: profile.openTo.length > 0, label: "Say what you're open to" },
    { done: showcase.rig.length > 0, label: "List your rig" },
    { done: !!showcase.signatureTone, label: "Choose a signature tone" },
    { done: !!showcase.pinnedPost, label: "Pin your best take" },
  ];
  const left = steps.filter((s) => !s.done);
  if (!left.length) return null;
  return (
    <section aria-labelledby="strength-h" className="panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="strength-h" className="label-engraved">Your profile</h2>
        <span className="font-mono text-xs text-muted">{steps.length - left.length}/{steps.length}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden><div className="h-full rounded-full bg-copper" style={{ width: `${((steps.length - left.length) / steps.length) * 100}%` }} /></div>
      <ul className="mt-3 space-y-1">
        {left.map((s) => <li key={s.label}><Link href="/settings" className="focus-ring -mx-2 flex items-center justify-between rounded-lg px-2 py-1.5 font-body text-sm text-ink-dim hover:bg-white/[0.04] hover:text-ink">{s.label}<Icon name="chevron-right" size={14} /></Link></li>)}
      </ul>
    </section>
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
