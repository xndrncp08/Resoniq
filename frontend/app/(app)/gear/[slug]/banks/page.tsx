import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { deviceTones } from "@/lib/tones";
import { bankLayout, slotLabel, TANK_G_SLOTS, TANK_G_SLUG, tankGAmp } from "@/lib/devices/tank-g";
import Icon from "@/components/icons/Icon";
import { buttonClass, EmptyState, LinkButton, PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "TANK-G bank planner", robots: { index: false } };

/** The viewer's saved and own TANK-G presets laid out across the pedal's 36 slots. */
export default async function TankGBanksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== TANK_G_SLUG) notFound();
  const actor = await requirePageActor(`/gear/${slug}/banks`);
  const gear = await prisma.gearItem.findUnique({ where: { slug }, select: { id: true } });
  if (!gear) notFound();
  const { slots, extra } = bankLayout(await deviceTones(actor.id, gear.id));
  const banks = Array.from({ length: TANK_G_SLOTS / 4 }, (_, b) => slots.slice(b * 4, b * 4 + 4));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="M-VAVE TANK-G" title="Bank planner" actions={slots.length > 0 && <a href="/api/tones/tank-g-banks" download className={buttonClass("primary", "md")}><Icon name="download" size={18} /> All setup sheets (.txt)</a>}>
        Your saved and own TANK-G presets across the pedal&apos;s 36 slots (banks 1–9 × A–D), clean banks first. Save or unsave presets to change the plan, then set each slot in LIVE mode and hold its footswitch to store it.
      </PageHeader>
      {slots.length === 0 ? (
        <EmptyState icon="bookmark" title="No TANK-G presets saved yet" action={<LinkButton href={`/gear/${slug}`} variant="primary">Browse TANK-G presets</LinkButton>}>Save presets from the library and they&apos;ll be placed into banks here.</EmptyState>
      ) : (
        <ol aria-label="Banks" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {banks.map((bank, b) => (
            <li key={b} className="panel p-4">
              <p className="label-engraved mb-3">Bank {b + 1}</p>
              <ol className="space-y-1.5">
                {[0, 1, 2, 3].map((i) => {
                  const t = bank[i];
                  const amp = t?.declared?.device?.ampSlot ? tankGAmp(t.declared.device.ampSlot) : undefined;
                  return (
                    <li key={i} className="flex min-w-0 items-center gap-3">
                      <span className="panel-inset flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-xs text-copper">{slotLabel(b * 4 + i)}</span>
                      {t ? (
                        <span className="min-w-0">
                          <Link href={`/t/${t.id}#tank-g-h`} className="block truncate font-body text-sm text-ink hover:text-copper">{t.name}</Link>
                          {amp && <span className="block truncate font-mono text-[11px] text-muted">Slot {amp.slot} · {amp.voicing}</span>}
                        </span>
                      ) : (
                        <span className="font-body text-sm text-muted">Empty</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
      {extra.length > 0 && (
        <section className="panel-inset rounded-2xl p-4">
          <p className="label-engraved mb-2">Doesn&apos;t fit ({extra.length})</p>
          <p className="font-body text-sm text-muted">The pedal stores 36 presets. Unsave some to bring these in: {extra.map((t, i) => <span key={t.id}>{i > 0 && ", "}<Link href={`/t/${t.id}`} className="text-copper hover:underline">{t.name}</Link></span>)}.</p>
        </section>
      )}
    </div>
  );
}
