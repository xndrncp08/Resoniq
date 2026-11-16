import type { Metadata } from "next";
import { LinkButton, PageHeader } from "@/components/app/ui";
import Metronome from "@/components/practice/Metronome";
import LoopPlayer from "@/components/practice/LoopPlayer";
import PracticeNote from "@/components/practice/PracticeNote";
import TempoLadder from "@/components/practice/TempoLadder";
import { optionalActor } from "@/lib/api";
import { getTone } from "@/lib/tones";
import { Provenance } from "@/components/app/ui";

type Props = { searchParams: Promise<{ tone?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tone } = await searchParams;
  return {
    title: "Practice room",
    description: "A free practice room for any musician. Tap a tempo, loop a recording, slow down a phrase and keep a practice note. No account needed.",
    // A tone can be unlisted; keep its practice context out of search results too.
    ...(tone && { robots: { index: false, follow: false } }),
  };
}

export default async function PracticePage({ searchParams }: Props) {
  const { tone: rawId } = await searchParams;
  const id = typeof rawId === "string" && rawId.length <= 100 ? rawId : undefined;
  const viewer = id ? await optionalActor() : null;
  const tone = id ? await getTone(id, viewer?.id ?? null) : null;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Practice" actions={<LinkButton href="/tones" icon="tone" variant="ghost">Find a sound to try</LinkButton>}>
        A metronome, a looper for the hard part, and a tempo ladder. Works with any instrument.
      </PageHeader>
      {tone && <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-copper/30 bg-copper/5 p-5"><div><p className="label-engraved mb-2">Your sound for this session</p><h2 className="font-display text-xl font-semibold">{tone.name}</h2><p className="mt-2 text-sm text-muted">Try one phrase. Adjust one setting. Listen to what changes.</p></div><div className="flex flex-wrap items-center gap-3"><Provenance kind={tone.origin === "generated" ? "generated" : tone.declared ? "declared" : "inferred"} /><LinkButton href={`/studio?tone=${tone.id}`} icon="amp">Hear it in the Amp Studio</LinkButton><LinkButton href={`/t/${tone.id}`} icon="tone">Open tone settings</LinkButton></div></aside>}
      <div className="grid items-start gap-5 lg:grid-cols-2"><Metronome /><LoopPlayer /></div>
      <TempoLadder />
      <PracticeNote />
    </div>
  );
}
