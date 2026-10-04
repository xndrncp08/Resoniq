import { prisma } from "@/lib/prisma";
import { recipeFromStoredTone } from "@/lib/tone-recipe";
import type { ToneRecipe } from "@/types/tone";

/** A user's saved tones as ToneRecipes, favorites first. Used by /library and the Studio. */
export async function loadLibrary(userId: string): Promise<ToneRecipe[]> {
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

  return tones
    .map((t) => recipeFromStoredTone(t, t.songId ? songById.get(t.songId) ?? null : null))
    .filter((r): r is ToneRecipe => r !== null);
}
