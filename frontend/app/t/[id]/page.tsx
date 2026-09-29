import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recipeFromStoredTone } from "@/lib/tone-recipe";
import AmpPanel from "@/components/tone/AmpPanel";
import Pedalboard from "@/components/tone/Pedalboard";
import RecipeSummary from "@/components/tone/RecipeSummary";

// Public, share-by-link view. The uploader's audio file is deliberately
// not exposed here — only the recipe is shared.
const loadRecipe = cache(async (id: string) => {
  const tone = await prisma.tone.findUnique({ where: { id } });
  if (!tone) return null;
  const song = tone.songId
    ? await prisma.song.findUnique({
        where: { id: tone.songId },
        select: { id: true, title: true, artist: true, fileUrl: true, createdAt: true },
      })
    : null;
  return recipeFromStoredTone(tone, song);
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const recipe = await loadRecipe((await params).id);
  if (!recipe) return { title: "Tone not found — Resoniq" };
  return {
    title: `${recipe.title} — Resoniq tone recipe`,
    description: recipe.recipeDescription,
  };
}

export default async function SharedTonePage({ params }: { params: Promise<{ id: string }> }) {
  const recipe = await loadRecipe((await params).id);
  if (!recipe) notFound();

  return (
    <main className="min-h-screen bg-bg px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">tone recipe</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{recipe.title}</h1>
        {recipe.artist !== "Unknown artist" && <p className="mt-2 font-body text-sm text-muted">{recipe.artist}</p>}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <AmpPanel amp={recipe.amp} cabinet={recipe.cabinet} pickup={recipe.pickup} />
          <RecipeSummary recipe={recipe} />
        </div>

        <section className="glass mt-6 rounded-panel p-6" aria-labelledby="pedals-heading">
          <h2 id="pedals-heading" className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-signal">
            pedalboard
          </h2>
          <Pedalboard pedals={recipe.pedalboard} />
        </section>

        <Link
          href="/analyze"
          className="focus-ring shadow-glow mx-auto mt-10 block max-w-sm rounded-full bg-copper py-3 text-center font-body text-sm font-semibold text-bg transition hover:bg-copper/90"
        >
          Analyze your own song. It&apos;s free.
        </Link>
      </div>
    </main>
  );
}
