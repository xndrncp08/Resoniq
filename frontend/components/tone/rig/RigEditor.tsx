"use client";

import { useState } from "react";
import Icon from "@/components/icons/Icon";
import { Button, IconButton } from "@/components/app/ui";
import GearPicker from "@/components/tone/rig/GearPicker";
import { BLOCK_CATEGORIES, type BlockCategory, type RigBlock, type RigSpec } from "@/types/rig";

const AMP_DEFAULT = ["Gain", "Bass", "Middle", "Treble", "Presence", "Master"];
const BLOCK_DEFAULTS: Partial<Record<BlockCategory, string[]>> = {
  drive: ["Drive", "Tone", "Level"], distortion: ["Distortion", "Tone", "Level"], fuzz: ["Fuzz", "Tone", "Volume"], boost: ["Level"],
  compressor: ["Sustain", "Level", "Blend"], delay: ["Time", "Feedback", "Mix"], reverb: ["Decay", "Tone", "Mix"], chorus: ["Rate", "Depth", "Mix"],
  phaser: ["Rate", "Depth"], flanger: ["Rate", "Depth", "Regen"], tremolo: ["Rate", "Depth"], eq: ["Low", "Mid", "High", "Level"], gate: ["Threshold"],
  octave: ["Sub", "Dry", "Up"], wah: ["Position"], volume: ["Level"],
};
const label = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function Knobs({ values, onChange, max = 10, step = 0.5 }: { values: Record<string, number | string>; onChange: (v: Record<string, number | string>) => void; max?: number; step?: number }) {
  const [adding, setAdding] = useState("");
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {Object.entries(values).map(([k, v]) => (
        <label key={k} className="block">
          <span className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted">
            {k}
            <button type="button" aria-label={`Remove ${k}`} onClick={() => { const { [k]: _, ...rest } = values; onChange(rest); }} className="text-muted hover:text-danger">×</button>
          </span>
          {typeof v === "number" ? (
            <span className="flex items-center gap-2">
              <input type="range" min={0} max={max} step={step} value={v} onChange={(e) => onChange({ ...values, [k]: Number(e.target.value) })} className="h-1 flex-1 accent-[var(--color-copper)]" aria-label={k} />
              <span className="w-9 text-right font-mono text-xs text-ink">{v}</span>
            </span>
          ) : (
            <input value={v} onChange={(e) => onChange({ ...values, [k]: e.target.value })} className="panel-inset h-8 w-full rounded-lg px-2 font-mono text-xs" aria-label={k} />
          )}
        </label>
      ))}
      <form
        className="flex items-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (adding.trim() && Object.keys(values).length < 16) onChange({ ...values, [adding.trim().slice(0, 32)]: 5 });
          setAdding("");
        }}
      >
        <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="+ control" aria-label="Add a control" className="panel-inset h-8 w-full rounded-lg px-2 font-mono text-xs" />
      </form>
    </div>
  );
}

function Section({ icon, title, onRemove, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="panel space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-display text-[15px] font-semibold"><Icon name={icon} size={18} className="text-copper" /> {title}</h4>
        {onRemove && <IconButton icon="close" label={`Remove ${title}`} size={32} onClick={onRemove} />}
      </div>
      {children}
    </div>
  );
}

/**
 * Builds a creator-declared rig one piece at a time. Nothing is required:
 * add only the parts you want to share.
 */
export default function RigEditor({ value, onChange }: { value: RigSpec; onChange: (rig: RigSpec) => void }) {
  const set = (patch: Partial<RigSpec>) => onChange({ ...value, ...patch });
  const setBlock = (i: number, patch: Partial<RigBlock>) => set({ chain: value.chain.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const move = (i: number, d: -1 | 1) => {
    const chain = [...value.chain];
    [chain[i], chain[i + d]] = [chain[i + d], chain[i]];
    set({ chain });
  };
  const addBlock = (category: BlockCategory) =>
    set({ chain: [...value.chain, { id: crypto.randomUUID().slice(0, 8), category, enabled: true, placement: ["delay", "reverb", "chorus", "flanger", "phaser", "tremolo"].includes(category) ? "loop" : "pre", params: Object.fromEntries((BLOCK_DEFAULTS[category] ?? []).map((k) => [k, 5])) }] });

  return (
    <div className="space-y-3">
      {!value.instrument ? null : (
        <Section icon={value.instrument.kind === "BASS" ? "bass" : "guitar"} title="Instrument" onRemove={() => set({ instrument: undefined })}>
          <div className="flex gap-1" role="group" aria-label="Instrument type">
            {(["GUITAR", "BASS"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={value.instrument!.kind === k} onClick={() => set({ instrument: { ...value.instrument!, kind: k } })} className={`rounded-full px-3 py-1 font-body text-sm ${value.instrument!.kind === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{k === "GUITAR" ? "Guitar" : "Bass"}</button>
            ))}
          </div>
          <GearPicker kind={value.instrument.kind} value={value.instrument.ref} placeholder="Model, e.g. Telecaster, Precision Bass" onChange={(ref) => set({ instrument: { ...value.instrument!, ref } })} />
          <div className="grid gap-2 sm:grid-cols-3">
            {(["pickupPosition", "tuning", "strings"] as const).map((k) => (
              <input key={k} value={value.instrument![k] ?? ""} onChange={(e) => set({ instrument: { ...value.instrument!, [k]: e.target.value || undefined } })} placeholder={{ pickupPosition: "Pickup position", tuning: "Tuning (e.g. Drop D)", strings: "Strings (e.g. 10–46)" }[k]} aria-label={k} className="panel-inset h-10 rounded-xl px-3 font-body text-sm outline-none" />
            ))}
          </div>
        </Section>
      )}

      {value.chain.length > 0 && (
        <Section icon="signal-chain" title="Signal chain">
          <ol className="space-y-2">
            {value.chain.map((b, i) => (
              <li key={b.id} className={`rounded-xl border p-3 ${b.enabled ? "border-line" : "border-dashed border-line opacity-60"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <select value={b.category} onChange={(e) => setBlock(i, { category: e.target.value as BlockCategory })} aria-label="Effect type" className="panel-inset h-8 rounded-lg px-2 font-body text-sm">
                    {BLOCK_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
                  </select>
                  <select value={b.placement} onChange={(e) => setBlock(i, { placement: e.target.value as "pre" | "loop" })} aria-label="Placement" className="panel-inset h-8 rounded-lg px-2 font-body text-sm">
                    <option value="pre">Into the amp</option>
                    <option value="loop">FX loop / after amp</option>
                  </select>
                  <label className="flex items-center gap-1.5 font-body text-xs text-muted">
                    <input type="checkbox" checked={b.enabled} onChange={(e) => setBlock(i, { enabled: e.target.checked })} className="accent-[var(--color-copper)]" /> On
                  </label>
                  <span className="ml-auto flex">
                    <IconButton icon="arrow-up" label="Move earlier" size={30} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton icon="arrow-down" label="Move later" size={30} disabled={i === value.chain.length - 1} onClick={() => move(i, 1)} />
                    <IconButton icon="trash" label="Remove block" size={30} onClick={() => set({ chain: value.chain.filter((_, j) => j !== i) })} />
                  </span>
                </div>
                <GearPicker kind={["PEDAL", "MULTIFX", "MODELER", "PLUGIN"]} value={b.ref} placeholder="Pedal or plugin, or type your own" onChange={(ref, controls) => setBlock(i, { ref, ...(controls?.length && { params: Object.fromEntries(controls.map((c) => [c, b.params[c] ?? 5])) }) })} />
                <div className="mt-3"><Knobs values={b.params} onChange={(params) => setBlock(i, { params })} /></div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {value.amp && (
        <Section icon="amp" title="Amp or modeler" onRemove={() => set({ amp: undefined })}>
          <GearPicker kind={["AMP", "MODELER", "PLUGIN", "MULTIFX"]} value={value.amp.ref} placeholder="Amp, modeler or plugin" onChange={(ref, controls) => set({ amp: { ...value.amp!, ref, ...(controls?.length && { settings: Object.fromEntries(controls.map((c) => [c, value.amp!.settings[c] ?? 5])) }) } })} />
          <input value={value.amp.channel ?? ""} onChange={(e) => set({ amp: { ...value.amp!, channel: e.target.value || undefined } })} placeholder="Channel (optional)" aria-label="Channel" className="panel-inset h-10 w-full rounded-xl px-3 font-body text-sm outline-none" />
          <Knobs values={value.amp.settings} onChange={(settings) => set({ amp: { ...value.amp!, settings: settings as Record<string, number> } })} />
        </Section>
      )}

      {value.cab && (
        <Section icon="cab" title="Cab & mic" onRemove={() => set({ cab: undefined })}>
          <GearPicker kind="CAB" value={value.cab.ref} placeholder="Cabinet or IR" onChange={(ref) => set({ cab: { ...value.cab!, ref } })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={value.cab.speakers ?? ""} onChange={(e) => set({ cab: { ...value.cab!, speakers: e.target.value || undefined } })} placeholder="Speakers" aria-label="Speakers" className="panel-inset h-10 rounded-xl px-3 font-body text-sm outline-none" />
            <input value={value.cab.mic ?? ""} onChange={(e) => set({ cab: { ...value.cab!, mic: e.target.value || undefined } })} placeholder="Mic & position" aria-label="Mic" className="panel-inset h-10 rounded-xl px-3 font-body text-sm outline-none" />
          </div>
        </Section>
      )}

      <div className="flex flex-wrap gap-2">
        {!value.instrument && <Button size="sm" icon="guitar" onClick={() => set({ instrument: { kind: "GUITAR" } })}>Instrument</Button>}
        <Button size="sm" icon="pedal" onClick={() => addBlock("drive")} disabled={value.chain.length >= 24}>Pedal / effect</Button>
        {!value.amp && <Button size="sm" icon="amp" onClick={() => set({ amp: { settings: Object.fromEntries(AMP_DEFAULT.map((k) => [k, 5])) } })}>Amp</Button>}
        {!value.cab && <Button size="sm" icon="cab" onClick={() => set({ cab: {} })}>Cab</Button>}
      </div>
      <textarea value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value || undefined })} rows={2} maxLength={4000} placeholder="Notes: picking dynamics, volume knob tricks, alternatives…" aria-label="Rig notes" className="panel-inset w-full rounded-xl px-3 py-2 font-body text-sm outline-none" />
    </div>
  );
}

export const emptyRig = (): RigSpec => ({ chain: [] });
export const rigIsEmpty = (r: RigSpec) => !r.instrument && !r.amp && !r.cab && r.chain.length === 0 && !r.notes;
