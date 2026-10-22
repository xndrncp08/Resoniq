import Icon from "@/components/icons/Icon";
import type { BlockCategory, GearRef, RigBlock, RigSpec } from "@/types/rig";

// Enclosure colors by effect family, like a real board: drives warm, time effects cool.
const FAMILY: Partial<Record<BlockCategory, string>> = {
  boost: "#FFB680", drive: "#FF8A3D", distortion: "#FF6B3D", fuzz: "#E8553A", compressor: "#C9C3B8", eq: "#8B93A1", gate: "#6C7584",
  wah: "#FFC24D", filter: "#FFC24D", pitch: "#B78CFF", octave: "#B78CFF", modulation: "#5FB8FF", chorus: "#5FB8FF", phaser: "#7FA7FF",
  flanger: "#7FA7FF", tremolo: "#4FD1C5", vibrato: "#4FD1C5", delay: "#37E6C9", reverb: "#2FB8A2", volume: "#C9C3B8", looper: "#8B93A1",
  "amp-sim": "#FF8A3D", "cab-sim": "#C9C3B8", ir: "#C9C3B8", multi: "#8B93A1", utility: "#6C7584",
};

const gear = (r?: GearRef) => (r ? [r.brand, r.model].filter(Boolean).join(" ") : null);
const name = (b: RigBlock) => gear(b.ref) ?? b.category.replace(/-/g, " ");

/** A small dial showing a 0–10 value (other ranges print as numbers). */
function Dial({ label, value }: { label: string; value: number | string }) {
  const n = typeof value === "number" && value >= 0 && value <= 10 ? value : null;
  const angle = n === null ? 0 : -135 + (n / 10) * 270;
  return (
    <span className="flex w-12 flex-col items-center gap-1" title={`${label}: ${value}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="11" fill="#0E1218" stroke="rgba(255,255,255,.18)" />
        {n !== null && <line x1="16" y1="16" x2="16" y2="7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${angle} 16 16)`} />}
        {n === null && <text x="16" y="19.5" textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="var(--font-mono)">{String(value).slice(0, 4)}</text>}
      </svg>
      <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-muted">{label}</span>
      {n !== null && <span className="font-mono text-[10px] text-ink">{n}</span>}
    </span>
  );
}

function Pedal({ block, index }: { block: RigBlock; index: number }) {
  const color = FAMILY[block.category] ?? "#8B93A1";
  const params = Object.entries(block.params).slice(0, 6);
  return (
    <li className={`relative flex w-[150px] shrink-0 snap-start flex-col rounded-[14px] border p-3 ${block.enabled ? "" : "opacity-50"}`} style={{ borderColor: `${color}66`, background: `linear-gradient(170deg, ${color}26, #0E1218 70%)` }}>
      <span className="flex items-center justify-between font-mono text-[10px] text-muted">
        <span>{String(index + 1).padStart(2, "0")} · {block.placement === "loop" ? "loop" : "front"}</span>
        <span className="h-2 w-2 rounded-full" style={{ background: block.enabled ? color : "#343D4C", boxShadow: block.enabled ? `0 0 8px ${color}` : undefined }} aria-label={block.enabled ? "On" : "Bypassed"} />
      </span>
      <span className="mt-2 line-clamp-2 min-h-[2.5em] font-display text-sm font-semibold leading-tight" style={{ color }}>{name(block)}</span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{block.category.replace(/-/g, " ")}{!block.ref?.gearId && block.ref ? " · custom" : ""}</span>
      {params.length > 0 && <span className="mt-3 flex flex-wrap justify-center gap-x-1 gap-y-2" style={{ color }}>{params.map(([k, v]) => <Dial key={k} label={k} value={v} />)}</span>}
      <span className="mx-auto mt-auto block h-7 w-7 translate-y-1 rounded-full border-2 border-white/20 bg-surface-3 pt-3" aria-hidden />
    </li>
  );
}

const Cable = () => <li aria-hidden className="h-px w-6 shrink-0 self-center bg-gradient-to-r from-copper/60 to-signal/60" />;

/**
 * The creator-declared rig drawn as a signal chain, input to output:
 * instrument → front-of-amp pedals → amp → loop effects → cab.
 */
export default function RigBoard({ rig }: { rig: RigSpec }) {
  const pre = rig.chain.filter((b) => b.placement !== "loop");
  const loop = rig.chain.filter((b) => b.placement === "loop");
  const node = (icon: Parameters<typeof Icon>[0]["name"], title: string, sub: string | null) => (
    <li className="panel-inset flex w-[150px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[14px] p-3 text-center">
      <Icon name={icon} size={30} className="text-copper" />
      <span className="font-display text-sm font-semibold leading-tight">{title}</span>
      {sub && <span className="font-mono text-[10px] text-muted">{sub}</span>}
    </li>
  );
  const seq: React.ReactNode[] = [];
  if (rig.instrument) seq.push(node(rig.instrument.kind === "BASS" ? "bass" : "guitar", gear(rig.instrument.ref) ?? (rig.instrument.kind === "BASS" ? "Bass" : "Guitar"), [rig.instrument.pickupPosition, rig.instrument.tuning].filter(Boolean).join(" · ") || null));
  pre.forEach((b) => seq.push(<Pedal block={b} index={rig.chain.indexOf(b)} />));
  if (rig.amp) seq.push(node("amp", gear(rig.amp.ref) ?? "Amp", rig.amp.channel ?? null));
  loop.forEach((b) => seq.push(<Pedal block={b} index={rig.chain.indexOf(b)} />));
  if (rig.cab) seq.push(node("cab", gear(rig.cab.ref) ?? "Cab", [rig.cab.speakers, rig.cab.mic].filter(Boolean).join(" · ") || null));

  return (
    <div className="space-y-4">
      {seq.length > 0 && (
        <ol aria-label="Signal chain, input to output" className="scrollbar-none flex snap-x items-stretch gap-0 overflow-x-auto pb-2">
          {seq.map((n, i) => (
            <span key={i} className="contents">
              {i > 0 && <Cable />}
              {n}
            </span>
          ))}
        </ol>
      )}
      {rig.amp && Object.keys(rig.amp.settings).length > 0 && (
        <div className="panel-inset rounded-2xl p-4">
          <p className="label-engraved mb-3">{gear(rig.amp.ref) ?? "Amp"} settings</p>
          <div className="flex flex-wrap gap-3 text-copper">{Object.entries(rig.amp.settings).map(([k, v]) => <Dial key={k} label={k} value={v} />)}</div>
        </div>
      )}
      {(rig.notes || rig.setupGuide) && (
        <div className="space-y-3 font-body text-[15px] leading-relaxed text-ink-dim">
          {rig.notes && <p className="whitespace-pre-wrap">{rig.notes}</p>}
          {rig.setupGuide && <><p className="label-engraved">Setup guide</p><p className="whitespace-pre-wrap">{rig.setupGuide}</p></>}
        </div>
      )}
      {rig.references && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm">
          {Object.entries(rig.references).map(([k, v]) => (
            <div key={k}><dt className="label-engraved">{k}</dt><dd className="text-ink-dim">{(v as string[]).join(", ")}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}
