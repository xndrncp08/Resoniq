import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { deviceTones } from "@/lib/tones";
import { bankLayout, TANK_G_SLUG, tankGAmp } from "@/lib/devices/tank-g";
import { EmptyState, LinkButton, PageHeader } from "@/components/app/ui";
import BankPlanner from "@/components/tone/BankPlanner";

export const metadata: Metadata = { title: "TANK-G bank planner", robots: { index: false } };

/** The viewer's saved and own TANK-G presets laid out across the pedal's 36 slots. */
export default async function TankGBanksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== TANK_G_SLUG) notFound();
  const actor = await requirePageActor(`/gear/${slug}/banks`);
  const gear = await prisma.gearItem.findUnique({ where: { slug }, select: { id: true } });
  if (!gear) notFound();
  const { slots, extra } = bankLayout(await deviceTones(actor.id, gear.id));
  const ordered = [...slots, ...extra];
  const tones = ordered.map((t) => {
    const amp = t.declared?.device?.ampSlot ? tankGAmp(t.declared.device.ampSlot) : undefined;
    // The page is already about the TANK-G, so the library's " · TANK-G" suffix only truncates names here.
    return { id: t.id, name: t.name.replace(/ · TANK-G$/, ""), amp: amp ? `Slot ${amp.slot} · ${amp.voicing}` : null };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="M-VAVE TANK-G" title="Bank planner">
        Plan which preset goes in each of the pedal&apos;s 36 slots (banks 1–9 × footswitches A–D). Your saved and own TANK-G presets start in a clean-to-lead order; change any slot and your plan is kept in this browser. Then set each slot in LIVE mode and hold its footswitch to store it.
      </PageHeader>
      {tones.length === 0 ? (
        <EmptyState icon="bookmark" title="No TANK-G presets saved yet" action={<LinkButton href={`/gear/${slug}`} variant="primary">Browse TANK-G presets</LinkButton>}>Save presets from the library and they&apos;ll be placed into banks here.</EmptyState>
      ) : (
        <BankPlanner userId={actor.id} tones={tones} defaultOrder={ordered.map((t) => t.id)} />
      )}
      <p className="font-body text-xs text-muted">Sheets are plain text for setting the pedal by hand. Resoniq doesn&apos;t write M-EFCS preset files because M-VAVE&apos;s format isn&apos;t documented.</p>
    </div>
  );
}
