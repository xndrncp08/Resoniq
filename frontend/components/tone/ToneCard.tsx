import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { Avatar, compact, Provenance } from "@/components/app/ui";
import type { ToneView } from "@/lib/tones";

const FAMILY_DOT: Record<string, string> = { drive: "#FF8A3D", fuzz: "#E8553A", distortion: "#FF6B3D", delay: "#37E6C9", reverb: "#2FB8A2", chorus: "#5FB8FF", compressor: "#C9C3B8" };

/** A tone in a grid: what it is, who made it, and a glance at the chain. */
export default function ToneCard({ tone }: { tone: ToneView }) {
  const chain = tone.declared?.chain ?? [];
  const amp = tone.declared?.amp?.ref?.model ?? tone.inferred?.amp.model;
  return (
    <Link href={`/t/${tone.id}`} className="focus-ring panel group flex h-full flex-col gap-3 p-4 transition-colors hover:border-copper/40">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug group-hover:text-copper-soft">{tone.name}</h3>
        {tone.visibility !== "PUBLIC" && <Icon name={tone.visibility === "PRIVATE" ? "lock" : "link"} size={16} className="shrink-0 text-muted" title={tone.visibility === "PRIVATE" ? "Private" : "Unlisted"} />}
      </div>
      <div className="panel-inset flex h-14 items-center gap-1.5 overflow-hidden rounded-xl px-3" aria-hidden>
        {tone.declared?.instrument && <Icon name={tone.declared.instrument.kind === "BASS" ? "bass" : "guitar"} size={20} className="shrink-0 text-ink-dim" />}
        {chain.slice(0, 7).map((b) => (
          <span key={b.id} className="h-8 w-6 shrink-0 rounded-[5px] border" style={{ borderColor: `${FAMILY_DOT[b.category] ?? "#8B93A1"}88`, background: `${FAMILY_DOT[b.category] ?? "#8B93A1"}22` }} />
        ))}
        {amp && <span className="ml-1 truncate font-mono text-xs text-ink-dim">→ {amp}</span>}
        {!tone.declared && tone.inferred && <Icon name="waveform" size={22} className="text-signal" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tone.origin === "generated" ? <Provenance kind="generated" /> : tone.declared && <Provenance kind="declared" />}
        {tone.inferred && <Provenance kind="inferred" edited={tone.recipeEdited} />}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex min-w-0 items-center gap-2 font-body text-sm text-muted">
          {tone.anonymous ? <span className="truncate">{tone.author.name}</span> : <><Avatar user={tone.author} size={22} /> <span className="truncate">@{tone.author.handle}</span></>}
        </span>
        <span className="flex shrink-0 gap-3 font-mono text-xs text-muted">
          <span title="Saves"><Icon name="bookmark" size={13} className="mr-0.5 inline" />{compact(tone.saveCount)}</span>
          <span title="Remixes"><Icon name="remix" size={13} className="mr-0.5 inline" />{compact(tone.remixCount)}</span>
        </span>
      </div>
      {tone.remixOf && <p className="font-mono text-[11px] text-muted">Remix of {tone.remixOf.name} by {tone.remixOf.anonymous ? tone.remixOf.author.name : `@${tone.remixOf.author.handle}`}</p>}
    </Link>
  );
}
