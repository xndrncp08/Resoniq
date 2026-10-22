import Link from "next/link";
import Icon from "@/components/icons/Icon";
import type { ToneView } from "@/lib/tones";
import ToneCard from "@/components/tone/ToneCard";
import FeaturedStrip from "@/components/social/FeaturedStrip";

/** Live content from the platform. Each block renders only when real rows exist. */
export default async function LiveBoard({ tones, viewerId }: { tones: ToneView[]; viewerId: string | null }) {
  return (
    <section className="mx-auto max-w-[1440px] space-y-16 px-4 py-12 sm:px-8" aria-label="On Resoniq now">
      <FeaturedStrip placement="LANDING" viewerId={viewerId} />
      {tones.length > 0 && (
        <div>
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="flex items-center gap-3 font-display text-4xl font-semibold tracking-tight"><Icon name="tone" size={30} className="text-copper" /> Most-saved tones</h2>
            <Link href="/tones?sort=popular" className="font-body text-sm text-copper hover:underline">All tones</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tones.map((t) => <ToneCard key={t.id} tone={t} />)}</div>
        </div>
      )}
    </section>
  );
}
