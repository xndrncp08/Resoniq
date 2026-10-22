import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { GEAR_SELECT } from "@/lib/gear";
import { listTones } from "@/lib/tones";
import Icon from "@/components/icons/Icon";
import { Chip, EmptyState, LinkButton } from "@/components/app/ui";
import ToneGrid from "@/components/tone/ToneGrid";
import { KIND_ICON } from "@/components/tone/gear-icons";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await prisma.gearItem.findFirst({ where: { slug: (await params).slug, status: "APPROVED" }, select: { brand: true, model: true } });
  return g ? { title: `${g.brand} ${g.model}`, description: `Tones shared on Resoniq using the ${g.brand} ${g.model}.` } : { title: "Gear not found" };
}

export default async function GearItemPage({ params }: Props) {
  const { slug } = await params;
  const item = await prisma.gearItem.findFirst({ where: { slug, status: "APPROVED" }, select: GEAR_SELECT });
  if (!item) notFound();
  const viewer = await optionalActor();
  const tones = await listTones(viewer?.id ?? null, { sort: "popular", gearId: item.id, cursor: null, limit: 18 });
  return (
    <div className="space-y-8">
      <header className="panel grille relative flex flex-wrap items-center gap-6 overflow-hidden p-6 sm:p-8">
        <span className="panel-inset flex h-28 w-28 items-center justify-center rounded-3xl text-copper"><Icon name={KIND_ICON[item.kind]} size={64} strokeWidth={1.25} /></span>
        <div className="min-w-0">
          <Chip>{item.kind.toLowerCase()}</Chip>
          <p className="mt-3 font-body text-lg text-muted">{item.brand}</p>
          <h1 className="font-display text-display-md font-semibold tracking-tight">{item.model}</h1>
          {item.controls.length > 0 && <p className="mt-3 font-mono text-xs text-muted">Controls: {item.controls.join(" · ")}</p>}
        </div>
      </header>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Public tones using it</h2>
        <ToneGrid endpoint={`/api/tones/public?sort=popular&gear=${item.id}&limit=18`} initial={tones.items} cursor={tones.nextCursor} empty={<EmptyState icon="tone" title="No public tones yet" action={<LinkButton href="/tones/new" variant="primary">Share a rig with it</LinkButton>} />} />
      </section>
    </div>
  );
}
