import { parseChordLine, transposeChord } from "@/lib/canvas/chords";
import type { CanvasContent } from "@/lib/canvas/merge";

/** Lyrics with each chord printed above the word it lands on, in arrangement order. Used in the editor and on stage. */
export default function ChordChart({ content, transpose = 0, size = "md" }: { content: Pick<CanvasContent, "sections" | "arrangement">; transpose?: number; size?: "md" | "stage" }) {
  const byId = new Map(content.sections.map((s) => [s.id, s]));
  const order = content.arrangement.length ? content.arrangement : content.sections.map((s) => s.id);
  const seen = new Map<string, number>();
  const text = size === "stage" ? "text-[clamp(1.1rem,2.6vw,1.9rem)]" : "text-[15px]";
  return (
    <div className={`space-y-6 ${text}`}>
      {order.map((id, i) => {
        const s = byId.get(id);
        if (!s) return null;
        const repeat = (seen.get(id) ?? 0) + 1;
        seen.set(id, repeat);
        return (
          <section key={`${id}-${i}`} aria-label={s.name}>
            <h3 className="mb-1 font-mono text-[0.7em] uppercase tracking-[0.16em] text-copper">{s.name}{repeat > 1 ? ` (again)` : ""}{s.bars ? <span className="text-muted"> · {s.bars} bars</span> : null}</h3>
            {repeat > 1 && size === "stage" ? null : s.lyrics.split("\n").map((line, j) => {
              const segs = parseChordLine(line);
              if (!segs.length) return <div key={j} className="h-[1.2em]" />;
              const hasChords = segs.some((x) => x.chord);
              return (
                <div key={j} className="flex flex-wrap items-end font-body leading-tight">
                  {segs.map((seg, k) => (
                    <span key={k} className="inline-flex flex-col whitespace-pre">
                      {hasChords && <span className="min-h-[1.2em] pr-1 font-mono text-[0.85em] font-semibold text-signal">{seg.chord ? transposeChord(seg.chord, transpose) : " "}</span>}
                      <span className="text-ink">{seg.text || (seg.chord ? " " : "")}</span>
                    </span>
                  ))}
                </div>
              );
            })}
            {s.notes && size !== "stage" && <p className="mt-1 font-body text-[0.85em] italic text-muted">{s.notes}</p>}
          </section>
        );
      })}
    </div>
  );
}
