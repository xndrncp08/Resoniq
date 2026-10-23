import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { Provenance } from "@/components/app/ui";
import type { PostTone } from "@/lib/posts";

/** The "inspect this tone" strip under a performance: what was declared, what was inferred, one tap to the full rig. */
export default function ToneAttachment({ tone }: { tone: PostTone }) {
  return (
    <Link href={`/t/${tone.id}`} className="focus-ring group panel-inset flex items-center gap-3 rounded-2xl p-3 transition-colors hover:border-copper/50">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-copper/12 text-copper">
        <Icon name="tone" size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-semibold">{tone.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {tone.declared && (
            <>
              <Provenance kind={tone.origin === "generated" ? "generated" : "declared"} />
              <span className="truncate font-mono text-xs text-ink-dim">
                {[tone.declared.instrument, tone.declared.amp, tone.declared.blocks ? `${tone.declared.blocks} blocks` : null].filter(Boolean).join(" → ")}
              </span>
            </>
          )}
          {tone.inferred && (
            <>
              <Provenance kind="inferred" edited={tone.inferred.edited} />
              <span className="truncate font-mono text-xs text-ink-dim">{tone.inferred.amp} · gain {tone.inferred.gain}</span>
            </>
          )}
        </span>
      </span>
      <span className="hidden items-center gap-1 font-body text-sm text-copper sm:flex">
        Inspect <Icon name="chevron-right" size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** A compact chip drawn over a playing video, linking to the rig used. */
export function RigOverlay({ tone }: { tone: PostTone }) {
  const label = tone.declared ? [tone.declared.instrument, tone.declared.amp].filter(Boolean).join(" · ") || tone.name : tone.inferred?.amp ?? tone.name;
  return (
    <Link href={`/t/${tone.id}`} className="focus-ring absolute left-3 top-3 z-10 inline-flex max-w-[75%] items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-body text-xs text-ink backdrop-blur-md hover:border-copper/60">
      <Icon name={tone.declared ? "declared" : "inferred"} size={14} className={tone.declared ? "text-copper" : "text-signal"} />
      <span className="truncate">Rig: {label}</span>
    </Link>
  );
}
