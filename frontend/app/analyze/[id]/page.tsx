import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageUserId } from "@/lib/session";
import AnalysisRunner from "@/components/tone/AnalysisRunner";
import type { EngineAnalysis } from "@/types/engine";

export const metadata: Metadata = { title: "Tone profile" };

export default async function SongStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requirePageUserId(`/analyze/${id}`);

  const song = await prisma.song.findFirst({ where: { id, userId } });
  if (!song) notFound();

  return (
    <main className="min-h-screen px-6 py-32">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          {song.artist ? `${song.artist} — ` : ""}
          {song.title ?? "Untitled upload"}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Tone profile
        </h1>
      </div>

      <div className="mx-auto mt-14 max-w-5xl">
        <AnalysisRunner
          song={{
            id: song.id,
            title: song.title,
            artist: song.artist,
            createdAt: song.createdAt.toISOString(),
          }}
          initialStatus={song.status}
          initialError={song.analysisError}
          // Prisma's Json type is opaque; this is the python-engine response stored verbatim.
          initialData={song.analysisData as EngineAnalysis | null}
        />
      </div>
    </main>
  );
}
