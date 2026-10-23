import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { diffTones } from "@/lib/tone-compare";
import { getTone, savedTones, type ToneView } from "@/lib/tones";
import { EmptyState, PageHeader, Provenance } from "@/components/app/ui";
import { tankGSheet } from "@/lib/devices/tank-g";

export const metadata: Metadata = { title: "Compare tones", robots: { index: false } };

const idFrom = (v?: string) => v?.trim().match(/([a-z0-9]{20,32})\/?$/i)?.[1] ?? v?.trim();

function Picker({ a, b, choices }: { a?: string; b?: string; choices: { id: string; name: string }[] }) {
  return (
    <form action="/compare" className="panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
      {(["a", "b"] as const).map((k) => (
        <label key={k} className="block">
          <span className="label-engraved">Tone {k.toUpperCase()}</span>
          <input name={k} defaultValue={k === "a" ? a : b} list="tone-choices" placeholder="Paste a tone link or pick one" className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-sm outline-none" />
        </label>
      ))}
      <datalist id="tone-choices">{choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</datalist>
      <button className="focus-ring h-11 self-end rounded-full bg-copper px-6 font-body font-semibold text-bg">Compare</button>
    </form>
  );
}

function Delta({ d }: { d: number | null }) {
  if (d === null || d === 0) return <span className="text-muted">{d === 0 ? "=" : "—"}</span>;
  return <span className={d > 0 ? "text-copper" : "text-signal"}>{d > 0 ? "+" : ""}{d}</span>;
}

function Header({ t, label }: { t: ToneView; label: string }) {
  return (
    <div className="min-w-0">
      <p className="label-engraved">{label}</p>
      <Link href={`/t/${t.id}`} className="block truncate font-display text-lg font-semibold hover:text-copper-soft">{t.name}</Link>
      <p className="font-mono text-xs text-muted">{t.anonymous ? t.author.name : `@${t.author.handle}`}{t.origin === "generated" && " · Resoniq-generated"}</p>
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams;
  const viewer = await optionalActor();
  const [a, b] = await Promise.all([idFrom(sp.a), idFrom(sp.b)].map((id) => (id ? getTone(id, viewer?.id ?? null) : null)));
  const choices = viewer
    ? [
        ...(await prisma.tone.findMany({ where: { userId: viewer.id }, select: { id: true, name: true }, take: 50, orderBy: { createdAt: "desc" } })),
        ...(await savedTones(viewer.id, null, 50)).items.map((t) => ({ id: t.id, name: t.name })),
      ]
    : [];
  const d = a && b ? diffTones(a, b) : null;
  // Both on the TANK-G: compare the panel itself, control by control.
  const [panelA, panelB] = [a, b].map((t) => (t?.declared ? tankGSheet(t.declared) : []));
  const panel = panelA.length && panelB.length ? panelA.map((r, i) => ({ control: r.control, a: r.setting, b: panelB[i].setting })) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="A/B" title="Compare tones">Knob by knob and block by block. Declared settings are only compared with declared ones, and inferred with inferred.</PageHeader>
      <Picker a={sp.a} b={sp.b} choices={choices} />
      {!d ? (
        <EmptyState icon="compare" title="Pick two tones">Open any tone and press Compare, or paste two tone links above.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="panel grid grid-cols-2 gap-4 p-4"><Header t={a!} label="A" /><Header t={b!} label="B" /></div>
          {panel && (
            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b hairline p-4"><h2 className="font-display text-lg font-semibold">M-VAVE TANK-G panel</h2><span className="font-mono text-xs text-muted">{panel.filter((r) => r.a !== r.b).length} of {panel.length} controls differ</span></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] font-mono text-sm">
                  <thead><tr className="text-left text-muted"><th scope="col" className="px-4 py-2 font-normal">Control</th><th scope="col" className="px-4 py-2 font-normal">A</th><th scope="col" className="px-4 py-2 font-normal">B</th></tr></thead>
                  <tbody>{panel.map((r) => <tr key={r.control} className={`border-t hairline ${r.a === r.b ? "text-muted" : "bg-copper/[0.04]"}`}><th scope="row" className="px-4 py-2 text-left font-normal text-ink-dim">{r.control}</th><td className="px-4 py-2">{r.a}</td><td className={`px-4 py-2 ${r.a === r.b ? "" : "text-copper"}`}>{r.b}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
          {d.instrument.a || d.instrument.b ? (
            <div className="panel grid grid-cols-2 gap-4 p-4 font-body"><span>{d.instrument.a ?? "—"}</span><span>{d.instrument.b ?? "—"}</span></div>
          ) : null}
          {[["Declared amp settings", d.declaredAmp, "declared"], ["Inferred amp settings (0–100)", d.inferredAmp, "inferred"]].map(([title, rows, kind]) =>
            (rows as typeof d.declaredAmp).length ? (
              <section key={title as string} className="panel overflow-hidden">
                <div className="flex items-center justify-between border-b hairline p-4"><h2 className="font-display text-lg font-semibold">{title as string}</h2><Provenance kind={kind as "declared" | "inferred"} /></div>
                <table className="w-full font-mono text-sm">
                  <thead><tr className="text-left text-muted"><th className="px-4 py-2 font-normal">Control</th><th className="px-4 py-2 font-normal">A</th><th className="px-4 py-2 font-normal">B</th><th className="px-4 py-2 font-normal">B − A</th></tr></thead>
                  <tbody>
                    {(rows as typeof d.declaredAmp).map((r) => (
                      <tr key={r.control} className="border-t hairline"><td className="px-4 py-2 text-ink-dim">{r.control}</td><td className="px-4 py-2">{r.a ?? "—"}</td><td className="px-4 py-2">{r.b ?? "—"}</td><td className="px-4 py-2"><Delta d={r.delta} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null,
          )}
          {d.chain.length > 0 && (
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b hairline p-4"><h2 className="font-display text-lg font-semibold">Signal chain</h2><Provenance kind="declared" /></div>
              <ol>
                {d.chain.map((r) => (
                  <li key={r.position} className={`grid grid-cols-[2.5rem_1fr_1fr] gap-3 border-t hairline px-4 py-2.5 font-body text-sm first:border-t-0 ${r.same ? "" : "bg-copper/[0.04]"}`}>
                    <span className="font-mono text-muted">{String(r.position).padStart(2, "0")}</span>
                    {[r.a, r.b].map((blk, i) => <span key={i} className={blk ? "" : "text-muted"}>{blk ? `${blk.ref?.model ?? blk.category}${blk.enabled ? "" : " (off)"}` : "—"}</span>)}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
