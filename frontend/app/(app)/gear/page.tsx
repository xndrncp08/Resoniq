import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GEAR_KINDS, GEAR_SELECT, popularGear } from "@/lib/gear";
import Icon from "@/components/icons/Icon";
import { KIND_ICON, KIND_LABEL } from "@/components/tone/gear-icons";
import { PageHeader, Tabs } from "@/components/app/ui";

export const metadata: Metadata = { title: "Gear", description: "The guitars, basses, amps, pedals, modelers and plugins in musicians' shared tones." };


export default async function GearPage({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string }> }) {
  const sp = await searchParams;
  const kind = GEAR_KINDS.find((k) => k === sp.kind) ?? null;
  const q = sp.q?.trim().slice(0, 80);
  const [items, popular] = await Promise.all([
    prisma.gearItem.findMany({
      where: { status: "APPROVED", ...(kind && { kind }), ...(q && { OR: [{ brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] }) },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      take: 300,
      select: GEAR_SELECT,
    }),
    popularGear(kind, 8),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Gear catalog" title="The gear behind the tones">Browse the catalog, then see the public tones built around each piece. Anything missing can be added as custom gear in a rig.</PageHeader>
      <form action="/gear" className="mb-4">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label className="sr-only" htmlFor="gq">Search gear</label>
        <input id="gq" name="q" defaultValue={q} placeholder="Search brands and models" className="panel-inset h-11 w-full max-w-md rounded-full px-4 font-body outline-none focus:border-copper/60" />
      </form>
      <Tabs label="Gear type" className="mb-6" items={[{ href: "/gear", label: "All", active: !kind }, ...GEAR_KINDS.map((k) => ({ href: `/gear?kind=${k}`, label: KIND_LABEL[k], active: kind === k }))]} />
      {popular.length > 0 && (
        <section className="mb-8">
          <h2 className="label-engraved mb-3">Most used in public tones</h2>
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
            {popular.map((g) => (
              <Link key={g.id} href={`/gear/${g.slug}`} className="focus-ring panel flex w-56 shrink-0 items-center gap-3 p-3 hover:border-copper/40">
                <span className="panel-inset flex h-11 w-11 items-center justify-center rounded-xl text-copper"><Icon name={KIND_ICON[g.kind]} size={22} /></span>
                <span className="min-w-0"><span className="block truncate font-body text-sm font-medium">{g.brand} {g.model}</span><span className="font-mono text-[11px] text-muted">{g.uses} tones</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((g) => (
          <li key={g.id}>
            <Link href={`/gear/${g.slug}`} className="focus-ring flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 hover:border-line hover:bg-surface">
              <Icon name={KIND_ICON[g.kind]} size={20} className="shrink-0 text-muted" />
              <span className="min-w-0 truncate font-body text-sm"><span className="text-muted">{g.brand}</span> {g.model}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
