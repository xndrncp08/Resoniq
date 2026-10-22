import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { KIND_ICON } from "@/components/tone/gear-icons";
import type { GearKind } from "@prisma/client";

/** A static selection from the live catalog, without duplicate links or a scrolling track. */
export default function GearWall({ items }: { items: { slug: string; brand: string; model: string; kind: GearKind }[] }) {
  if (!items.length) return null;
  return (
    <section className="border-y hairline bg-bg-0 py-8" aria-labelledby="catalog-preview">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="mb-5 flex items-center justify-between gap-4"><h2 id="catalog-preview" className="label-engraved">Real gear. Endless starting points.</h2><Link href="/gear" className="rounded py-2 font-body text-sm text-copper hover:underline">Full catalog ↗</Link></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.slice(0, 8).map((g) => <Link key={g.slug} href={`/gear/${g.slug}`} className="panel flex min-w-0 items-center gap-3 px-4 py-3 hover:border-copper/40"><Icon name={KIND_ICON[g.kind]} size={22} className="shrink-0 text-copper" /><span className="min-w-0 font-body text-sm"><span className="block text-xs text-muted">{g.brand}</span><span className="block truncate">{g.model}</span></span></Link>)}</div>
      </div>
    </section>
  );
}
