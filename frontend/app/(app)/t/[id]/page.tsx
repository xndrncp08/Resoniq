import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { GENERATED_DISCLOSURE, getTone } from "@/lib/tones";
import { listPosts } from "@/lib/posts";
import Icon from "@/components/icons/Icon";
import { Avatar, Chip, compact, ManagedCreatorBadge, Provenance, TimeAgo } from "@/components/app/ui";
import RecipeSummary from "@/components/tone/RecipeSummary";
import { AmpPanel, Pedalboard } from "@/components/tone/InferredPanels";
import RigBoard from "@/components/tone/rig/RigBoard";
import ToneActions from "@/components/tone/ToneActions";
import TankGPanel from "@/components/tone/TankGPanel";
import PostCard from "@/components/social/PostCard";

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const viewer = await optionalActor();
  return { viewer, tone: await getTone(id, viewer?.id ?? null) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tone } = await load((await params).id);
  if (!tone) return { title: "Tone not found", robots: { index: false } };
  return {
    title: `${tone.name} · tone`,
    description: tone.description ?? tone.inferred?.recipeDescription ?? (tone.anonymous ? "A tone on Resoniq" : `A tone by @${tone.author.handle} on Resoniq`),
    // Only public tones are meant to be found; unlisted ones are shared by link.
    robots: tone.visibility === "PUBLIC" ? undefined : { index: false, follow: false },
    openGraph: { images: [`/api/og/tone/${tone.id}`] },
  };
}

export default async function TonePage({ params }: Props) {
  const { id } = await params;
  const { viewer, tone } = await load(id);
  if (!tone) notFound();
  const heardIn = await listPosts({ toneId: tone.id }, viewer?.id ?? null, { sort: "top", window: "all", cursor: null, limit: 3 });
  const songTitle = tone.songId ? (await prisma.song.findUnique({ where: { id: tone.songId }, select: { title: true } }))?.title : null;
  const inferred = tone.inferred;
  const generated = tone.origin === "generated";

  return (
    <div className="space-y-8">
      <header className="panel grille relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-32 h-80 w-80 rounded-full bg-copper/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-signal/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip icon="tone">Tone</Chip>
            {tone.author.managedCreator && <ManagedCreatorBadge />}
            {tone.visibility !== "PUBLIC" && <Chip icon={tone.visibility === "PRIVATE" ? "lock" : "link"}>{tone.visibility.toLowerCase()}</Chip>}
            {generated ? <Provenance kind="generated" /> : tone.declared && <Provenance kind="declared" />}
            {inferred && <Provenance kind="inferred" edited={tone.recipeEdited} />}
          </div>
          <h1 className="max-w-4xl font-display text-display-md font-semibold tracking-tight">{tone.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-body text-sm text-muted">
            {tone.anonymous ? (
              <span className="text-ink">{tone.author.name}</span>
            ) : (
              <Link href={`/u/${tone.author.handle}`} className="flex items-center gap-2 text-ink hover:underline"><Avatar user={tone.author} size={28} /> {tone.author.name ?? `@${tone.author.handle}`}</Link>
            )}
            <span>Updated <TimeAgo iso={tone.updatedAt} /></span>
            <span className="font-mono">{compact(tone.saveCount)} saves · {compact(tone.remixCount)} remixes</span>
          </div>
          {tone.remixOf && (
            <p className="mt-3 flex items-center gap-2 font-body text-sm text-ink-dim">
              <Icon name="remix" size={16} className="text-copper" /> Remixed from <Link href={`/t/${tone.remixOf.id}`} className="text-copper hover:underline">{tone.remixOf.name}</Link> by {tone.remixOf.anonymous ? tone.remixOf.author.name : <Link href={`/u/${tone.remixOf.author.handle}`} className="hover:underline">@{tone.remixOf.author.handle}</Link>}
            </p>
          )}
          {tone.description && <p className="mt-4 max-w-3xl whitespace-pre-wrap font-body text-[15px] leading-relaxed text-ink-dim">{tone.description}</p>}
          {generated && !tone.description?.includes(GENERATED_DISCLOSURE) && <p className="mt-3 max-w-3xl font-body text-sm text-amber">{GENERATED_DISCLOSURE}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ToneActions id={tone.id} isOwner={tone.viewer.isOwner} saved={tone.viewer.saved} visibility={tone.visibility} signedIn={!!viewer} />
            {generated && tone.visibility === "PUBLIC" && viewer && (
              <Link href={`/new?tone=${tone.id}&category=TONE_COMPARISON`} className="focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 font-body text-sm text-ink hover:border-copper/50"><Icon name="comment" size={16} /> Discuss this tone</Link>
            )}
          </div>
        </div>
      </header>

      <section id="rig" aria-labelledby="declared-h" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="declared-h" className="font-display text-2xl font-semibold">{generated ? "Suggested rig" : "The rig"}</h2>
          <Provenance kind={generated ? "generated" : "declared"} />
        </div>
        {tone.declared ? (
          <RigBoard rig={tone.declared} />
        ) : (
          <p className="panel-inset rounded-2xl p-5 font-body text-sm text-muted">
            The creator hasn&apos;t declared their gear for this tone.{tone.viewer.isOwner && <> <Link href={`/t/${tone.id}/edit`} className="text-copper hover:underline">Add your rig</Link> so others can see what you actually played.</>}
          </p>
        )}
      </section>

      {tone.declared?.device && <TankGPanel toneId={tone.id} rig={tone.declared} />}

      {inferred && (
        <section aria-labelledby="inferred-h" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="inferred-h" className="font-display text-2xl font-semibold">What Resoniq heard</h2>
            <Provenance kind="inferred" edited={tone.recipeEdited} />
          </div>
          <p className="max-w-3xl font-body text-sm text-muted">
            Estimated from the recording{songTitle ? ` “${songTitle}”` : ""} by Resoniq&apos;s analysis: a closest-match starting point with heuristic confidence, not a verified rig.
            {tone.recipeEdited && " The creator adjusted these settings after the analysis."}
          </p>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <AmpPanel amp={inferred.amp} cabinet={inferred.cabinet} pickup={inferred.pickup} />
            <RecipeSummary recipe={inferred} />
          </div>
          {inferred.pedalboard.length > 0 && (
            <div className="glass rounded-panel p-6">
              <h3 className="label-engraved mb-4">Inferred pedalboard</h3>
              <Pedalboard pedals={inferred.pedalboard} />
            </div>
          )}
        </section>
      )}

      {heardIn.items.length > 0 && (
        <section aria-labelledby="heard-h" className="space-y-4">
          <h2 id="heard-h" className="font-display text-2xl font-semibold">{generated ? "Discussions" : "Heard in"}</h2>
          <div className="grid gap-4 lg:grid-cols-2">{heardIn.items.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewer} />)}</div>
        </section>
      )}
    </div>
  );
}
