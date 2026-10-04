import type { RecipeCore } from "@/types/tone";

/** Description, confidence and reference artists — framed as a closest match, not a gear ID. */
export default function RecipeSummary({
  recipe,
}: {
  recipe: Pick<RecipeCore, "confidenceScore" | "recipeDescription" | "similarArtists">;
}) {
  return (
    <div className="glass rounded-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">closest match</div>
        <div className="font-mono text-[11px] tabular-nums text-muted">
          heuristic confidence <span className="text-ink">{recipe.confidenceScore}%</span>
        </div>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/5"
        role="meter"
        aria-label="Heuristic confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={recipe.confidenceScore}
      >
        <div className="h-full rounded-full bg-copper" style={{ width: `${recipe.confidenceScore}%` }} />
      </div>

      <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">as analyzed</div>
      <p className="mt-1.5 text-pretty font-body text-sm leading-relaxed text-ink/90">{recipe.recipeDescription}</p>

      {recipe.similarArtists.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">in the neighbourhood of</div>
          <ul className="flex flex-wrap gap-1.5">
            {recipe.similarArtists.map((a) => (
              <li key={a} className="rounded-full border border-white/10 px-3 py-1 font-body text-xs text-ink/80">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 font-body text-[11px] leading-relaxed text-muted">
        Inferred from the recording&apos;s audio features. Treat it as a starting point to dial in by ear, not the
        artist&apos;s verified rig.
      </p>
    </div>
  );
}
