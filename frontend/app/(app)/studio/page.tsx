import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { getTone } from "@/lib/tones";
import { prisma } from "@/lib/prisma";
import { recipeCoreFromAnalysis, sectionAnalysis } from "@/lib/tone-recipe";
import type { EngineAnalysis } from "@/types/engine";
import StudioApp from "@/components/studio/StudioApp";

type Props = { searchParams: Promise<{ tone?: string | string[]; song?: string | string[]; section?: string | string[]; saved?: string | string[] }> };

const param = (v: string | string[] | undefined) => (typeof v === "string" && v.length <= 100 ? v : undefined);

/** One section of the viewer's own analysed song, as a starting point (owner only). */
async function sectionStart(viewerId: string | null, songId?: string, sectionId?: string) {
  if (!viewerId || !songId || !sectionId) return null;
  const song = await prisma.song.findFirst({ where: { id: songId, userId: viewerId, status: "ANALYZED" }, select: { id: true, title: true, analysisData: true } });
  const analysis = song?.analysisData ? sectionAnalysis(song.analysisData as unknown as EngineAnalysis, sectionId) : null;
  if (!song || !analysis) return null;
  const type = (song.analysisData as unknown as EngineAnalysis).sections?.find((s) => s.id === sectionId)?.type ?? "";
  return { songId: song.id, sectionId, name: `${song.title ?? "Untitled"} · section ${type}`, recipe: recipeCoreFromAnalysis(analysis) };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tone, song } = await searchParams;
  return {
    title: "Amp Studio",
    description: "Dial in amps, cabinets and effects on tactile 3D equipment, hear it live in your browser, and save the sound.",
    // A tone can be unlisted; don't index a studio view of it.
    ...((tone || song) && { robots: { index: false, follow: false } }),
  };
}

export default async function StudioPage({ searchParams }: Props) {
  const q = await searchParams;
  const id = param(q.tone);
  const viewer = await optionalActor();
  const tone = id ? await getTone(id, viewer?.id ?? null) : null;
  const section = tone ? null : await sectionStart(viewer?.id ?? null, param(q.song), param(q.section));
  if (section) {
    return (
      <StudioApp
        key={`${section.songId}:${section.sectionId}`}
        initial={{ studio: null, declared: null, inferred: section.recipe }}
        origin={{ toneId: null, name: section.name, isOwner: false, deviceRig: null, songId: section.songId, sectionId: section.sectionId, recipe: section.recipe }}
        context={<Link href={`/analyze/${section.songId}`} className="focus-ring rounded-full border border-line px-3 py-1 font-body text-xs text-muted hover:text-ink">Back to the analysis</Link>}
      />
    );
  }
  return (
    <StudioApp
      key={tone?.id ?? "new"}
      justSaved={!!tone?.viewer.isOwner && param(q.saved) === "1"}
      initial={{ studio: tone?.studio ?? null, declared: tone?.declared ?? null, inferred: tone?.inferred ?? null }}
      origin={{ toneId: tone?.id ?? null, name: tone?.name ?? "New sound", isOwner: !!tone?.viewer.isOwner, deviceRig: tone?.declared?.device ? tone.declared : null }}
      context={
        id && !tone ? (
          <span className="font-body text-xs text-amber">That tone isn&apos;t available, so this is a fresh start.</span>
        ) : tone ? (
          <Link href={`/t/${tone.id}`} className="focus-ring rounded-full border border-line px-3 py-1 font-body text-xs text-muted hover:text-ink">Tone page</Link>
        ) : null
      }
    />
  );
}
