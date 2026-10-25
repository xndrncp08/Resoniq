import type { Metadata } from "next";
import Link from "next/link";
import { optionalActor } from "@/lib/api";
import { getTone } from "@/lib/tones";
import StudioApp from "@/components/studio/StudioApp";

type Props = { searchParams: Promise<{ tone?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tone } = await searchParams;
  return {
    title: "Amp Studio",
    description: "Dial in amps, cabinets and effects on tactile 3D equipment, hear it live in your browser, and save the sound.",
    // A tone can be unlisted; don't index a studio view of it.
    ...(tone && { robots: { index: false, follow: false } }),
  };
}

export default async function StudioPage({ searchParams }: Props) {
  const { tone: raw } = await searchParams;
  const id = typeof raw === "string" && raw.length <= 100 ? raw : undefined;
  const viewer = await optionalActor();
  const tone = id ? await getTone(id, viewer?.id ?? null) : null;
  return (
    <StudioApp
      key={tone?.id ?? "new"}
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
