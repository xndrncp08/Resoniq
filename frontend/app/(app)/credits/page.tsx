import type { Metadata } from "next";
import { PageHeader } from "@/components/app/ui";
import { PHOTO_CREDITS } from "@/lib/photo-credits";

export const metadata: Metadata = { title: "Credits", description: "Where the photographs and artwork on Resoniq come from." };

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Credits" title="Photographs and artwork" />
      <p className="font-body text-ink-dim">
        The studio scenes were generated for Resoniq. The players photographs are public domain (CC0 1.0) from rawpixel, found through
        Openverse; no attribution is required, and we give it anyway. Default profile pictures and the amps, cabinets and pedals in the
        Amp Studio are original Resoniq renders.
      </p>
      <ul className="mt-8 divide-y divide-line rounded-2xl border border-line">
        {PHOTO_CREDITS.map((c) => (
          <li key={c.file} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="font-body text-sm text-ink">{c.subject}</span>
            <span className="font-mono text-xs text-muted">
              {c.license} · {c.href ? <a href={c.href} className="underline hover:text-ink" rel="noopener noreferrer" target="_blank">{c.source}</a> : c.source}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
