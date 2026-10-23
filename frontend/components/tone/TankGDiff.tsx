import Link from "next/link";
import type { tankGDiff } from "@/lib/devices/tank-g";

type Rows = NonNullable<ReturnType<typeof tankGDiff>>;

/** The TANK-G panel compared control by control, grouped like the pedal, with changes marked in text, not only colour. */
export default function TankGDiff({ rows, changesOnly, toggleHref }: { rows: Rows; changesOnly: boolean; toggleHref: string }) {
  const changed = rows.filter((r) => r.changed).length;
  const shown = changesOnly ? rows.filter((r) => r.changed) : rows;
  const sections = [...new Set(shown.map((r) => r.section))];
  return (
    <section aria-labelledby="tank-diff-h" className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline p-4">
        <div>
          <h2 id="tank-diff-h" className="font-display text-lg font-semibold">M-VAVE TANK-G panel</h2>
          <p className="font-mono text-xs text-muted">{changed === 0 ? "Identical panel settings" : `${changed} of ${rows.length} controls differ`}</p>
        </div>
        {changed > 0 && <Link href={toggleHref} scroll={false} className="focus-ring rounded-full border border-line px-3 py-1.5 font-body text-sm text-ink hover:border-copper/50">{changesOnly ? "Show all controls" : "Show changes only"}</Link>}
      </div>
      <div role="region" aria-label="TANK-G panel comparison" tabIndex={0} className="focus-ring overflow-x-auto">
        <table className="w-full min-w-[520px] font-mono text-sm">
          <thead><tr className="text-left text-muted"><th scope="col" className="px-4 py-2 font-normal">Control</th><th scope="col" className="px-4 py-2 font-normal">A</th><th scope="col" className="px-4 py-2 font-normal">B</th><th scope="col" className="px-4 py-2 font-normal">B − A</th></tr></thead>
          {sections.map((s) => (
            <tbody key={s}>
              <tr className="border-t hairline"><th scope="rowgroup" colSpan={4} className="label-engraved bg-white/[0.02] px-4 py-2 text-left">{s}</th></tr>
              {shown.filter((r) => r.section === s).map((r) => (
                <tr key={r.control} className={`border-t hairline ${r.changed ? "bg-copper/[0.05]" : "text-muted"}`}>
                  <th scope="row" className="px-4 py-2 text-left font-normal text-ink-dim">
                    {r.changed && <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-copper align-middle" />}
                    {r.control}{r.changed && <span className="sr-only"> (changed)</span>}
                  </th>
                  <td className="px-4 py-2">{r.a}</td>
                  <td className={`px-4 py-2 ${r.changed ? "text-copper" : ""}`}>{r.b}</td>
                  <td className="px-4 py-2 tabular-nums">{r.delta === null ? (r.changed ? <span className="text-muted">changed</span> : "=") : <span className={r.delta > 0 ? "text-copper" : "text-signal"}>{r.delta > 0 ? "+" : ""}{r.delta}</span>}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
