import { prisma } from "@/lib/prisma";
import { recipeFromStoredTone } from "@/lib/tone-recipe";
import type { ToneRecipe } from "@/types/tone";
import ToneLibraryClient from "@/components/library/ToneLibraryClient";
import { requirePageUserId } from "@/lib/session";

export default async function LibraryPage() {
  const userId = await requirePageUserId("/library");

  const tones = await prisma.tone.findMany({
    where: { userId },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
  });

  const songIds = [...new Set(tones.map((t) => t.songId).filter((id): id is string => !!id))];
  const songs = await prisma.song.findMany({
    where: { id: { in: songIds }, userId },
    select: { id: true, title: true, artist: true, createdAt: true },
  });
  const songById = new Map(songs.map((s) => [s.id, s]));

  const recipes = tones
    .map((t) => recipeFromStoredTone(t, t.songId ? songById.get(t.songId) ?? null : null))
    .filter((r): r is ToneRecipe => r !== null);

  return (
    <main className="min-h-screen bg-bg px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">library</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your saved tones</h1>

        <div className="mt-12">
          <ToneLibraryClient initialTones={recipes} />
        </div>
      </div>
    </main>
  );
}
