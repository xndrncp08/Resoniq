import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { KIND_ICON } from "@/components/tone/gear-icons";
import type { GearKind } from "@prisma/client";

/** Two rows of the real catalog drifting past, each linking to the tones built around it. */
export default function GearWall({ items }: { items: { slug: string; brand: string; model: string; kind: GearKind }[] }) {
  const rows = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)];
  return (
    <section className="overflow-hidden border-y hairline bg-bg-0 py-10" aria-label="From the gear catalog">
      {rows.map((row, r) => (
        <div key={r} className="group flex w-max gap-3 py-1.5 hover:[animation-play-state:paused]" style={{ animation: `marquee ${70 + r * 15}s linear infinite${r ? " reverse" : ""}` }}>
          {[...row, ...row].map((g, i) => (
            <Link key={`${g.slug}-${i}`} href={`/gear/${g.slug}`} tabIndex={i >= row.length ? -1 : undefined} aria-hidden={i >= row.length ? true : undefined} className="focus-ring panel inline-flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 font-body text-sm text-ink-dim hover:border-copper/40 hover:text-ink">
              <Icon name={KIND_ICON[g.kind]} size={18} className="text-copper" /><span className="text-muted">{g.brand}</span> {g.model}
            </Link>
          ))}
        </div>
      ))}
    </section>
  );
}
