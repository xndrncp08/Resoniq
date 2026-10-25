import type { Metadata } from "next";
import { LinkButton } from "@/components/app/ui";
import Metronome from "@/components/practice/Metronome";
import LoopPlayer from "@/components/practice/LoopPlayer";
import PracticeNote from "@/components/practice/PracticeNote";
import { optionalActor } from "@/lib/api";
import { getTone } from "@/lib/tones";
import { Provenance } from "@/components/app/ui";

export const metadata: Metadata = { title: "Practice room", description: "A free practice room for any musician. Tap a tempo, loop a recording, slow down a phrase and keep a practice note. No account needed." };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ tone?: string | string[] }> }) {
  const { tone: rawId } = await searchParams;
  const id = typeof rawId === "string" && rawId.length <= 100 ? rawId : undefined;
  const viewer = id ? await optionalActor() : null;
  const tone = id ? await getTone(id, viewer?.id ?? null) : null;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="relative overflow-hidden border-b border-line pb-8 pt-2 sm:pb-10">
        <p className="label-engraved mb-4 text-signal">The practice room / Open to everyone</p>
        <h1 className="max-w-4xl font-display text-display-lg font-semibold tracking-tight">Less scrolling.<br /><span className="text-copper">More playing.</span></h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-5"><p className="max-w-xl text-pretty text-ink-dim">One phrase. One sound. One small breakthrough. Make space for the music, whatever you play and whatever gear you have.</p><LinkButton href="/tones" icon="tone">Find a sound to try</LinkButton></div>
      </header>
      {tone && <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-copper/30 bg-copper/5 p-5"><div><p className="label-engraved mb-2">Your sound for this session</p><h2 className="font-display text-xl font-semibold">{tone.name}</h2><p className="mt-2 text-sm text-muted">Try one phrase. Adjust one setting. Listen to what changes.</p></div><div className="flex flex-wrap items-center gap-3"><Provenance kind={tone.origin === "generated" ? "generated" : tone.declared ? "declared" : "inferred"} /><LinkButton href={`/t/${tone.id}`} icon="tone">Open tone settings</LinkButton></div></aside>}
      <div className="grid items-start gap-5 lg:grid-cols-2"><Metronome /><LoopPlayer /></div>
      <PracticeNote />
      <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line p-5"><div><h2 className="font-display text-xl font-semibold">Music gets better with other ears.</h2><p className="mt-1 text-sm text-muted">Share a work in progress, trade ideas, or find someone to play with.</p></div><div className="flex flex-wrap gap-2"><LinkButton href="/new?prompt=collaboration" icon="community">Find a collaborator</LinkButton><LinkButton href="/c">Find your people</LinkButton></div></aside>
    </div>
  );
}
