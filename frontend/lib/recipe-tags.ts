import type { ToneRecipe } from "@/types/tone";

/** Filterable tags derived from a recipe's content (nothing is stored). */
export function recipeTags(recipe: ToneRecipe): string[] {
  const gain = recipe.amp.gain;
  const tags = [
    gain < 30 ? "Clean" : gain < 55 ? "Crunch" : gain < 75 ? "Overdrive" : "High gain",
    recipe.amp.family,
    `${recipe.pickup} pickup`,
  ];
  const types = new Set(recipe.pedalboard.filter((p) => p.enabled).map((p) => p.type));
  if (types.has("modulation")) tags.push("Modulation");
  if (types.has("time")) tags.push("Ambient");
  if (types.has("dynamics")) tags.push("Compressed");
  return tags;
}

/** Text a library search matches against. */
export function recipeSearchText(recipe: ToneRecipe): string {
  return [
    recipe.title,
    recipe.artist,
    recipe.amp.family,
    recipe.amp.model,
    recipe.cabinet.type,
    ...recipe.pedalboard.map((p) => p.name),
    ...recipe.similarArtists,
  ]
    .join(" ")
    .toLowerCase();
}
