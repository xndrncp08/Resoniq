"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Component, createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "zustand";
import Icon from "@/components/icons/Icon";
import Dialog from "@/components/app/Dialog";
import { Button } from "@/components/app/ui";
import { Meter, StudioKnob, StudioSwitch } from "@/components/studio/controls";
import { useStudioAudio, type SourceKind } from "@/components/studio/useStudioAudio";
import { createStudioStore, isDirty, type StudioState, type StudioStore, type StudioView } from "@/lib/stores/studio-store";
import { describeEdit } from "@/lib/studio/readout";
import { useConfirmLeave, useUnsavedChanges } from "@/components/app/UnsavedChanges";
import { reportClientError } from "@/components/app/ErrorReporter";
import { AMP_DESIGNS, AMP_MODELS, CAB_DESIGNS, CAB_MODELS, EFFECT_DESIGNS, EFFECT_TYPES, FACTORY_PRESETS, GATE_RANGE, LEVEL_RANGE, MAX_EFFECTS, newEffect, orderEffects, type AmpKnob, type AmpSwitch, type EffectType, type StudioPatch } from "@/lib/studio/patch";
import type { StudioDevice } from "@/lib/studio/devices";
import { patchFromTone } from "@/lib/studio/from-tone";
import { presetsQuery, useSaveStudio, type SaveMode, type StudioOrigin } from "@/lib/queries/studio";
import { errorMessage } from "@/lib/client-api";
import { usePreferences, usePreferencesHydration } from "@/lib/stores/preferences";
import { decideScene3d, lowPowerDevice, webglAvailable } from "@/components/three/webgl";

const StudioScene = dynamic(() => import("@/components/studio/three/StudioScene"), { ssr: false, loading: () => <StageMessage>Wiring the rig…</StageMessage> });

// ── Store wiring ───────────────────────────────────────────────────────

const StoreContext = createContext<StudioStore | null>(null);
function useStudio<T>(select: (s: StudioState) => T) {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Studio store missing");
  return useStore(store, select);
}
function useStudioStore() {
  return useContext(StoreContext)!;
}

const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const noSubscribe = () => () => {};

function StageMessage({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center"><span className="label-engraved animate-pulse">{children}</span></div>;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportClientError("boundary", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ── Amp controls for the current design or device ──────────────────────

function useAmpControls(): { knobs: { key: AmpKnob; label: string }[]; switches: { key: AmpSwitch; label: string }[] } {
  const model = useStudio((s) => s.patch.amp.model);
  const device = useStudio((s) => s.device);
  return useMemo(() => (device ? { knobs: device.ampKnobs, switches: [] } : { knobs: AMP_DESIGNS[model].knobs, switches: AMP_DESIGNS[model].switches }), [model, device]);
}

// ── Rack: input, gate, presets, compare, output ────────────────────────

function Rack({ audio, origin, signedIn, onSave }: { audio: ReturnType<typeof useStudioAudio>; origin: StudioOrigin; signedIn: boolean; onSave: (mode: SaveMode) => void }) {
  const store = useStudioStore();
  const patch = useStudio((s) => s.patch);
  const active = useStudio((s) => s.active);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const dirty = useStudio(isDirty);
  const { edit, undo, redo, switchSlot, copyToOther, reset } = store.getState();
  const playing = audio.status.state === "playing";
  return (
    // Phones: input and output share the top row, presets get the full width below. Desktop: one row.
    <div className="grid grid-cols-[1fr_auto] items-end gap-4 border-b border-line bg-[linear-gradient(180deg,#121419,#0b0c10)] px-4 py-4 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div className="col-start-1 row-start-1 flex items-end gap-4">
        <StudioKnob label="Input" value={patch.input} min={LEVEL_RANGE.min} max={LEVEL_RANGE.max} step={0.5} defaultValue={0} format={db} onChange={(v) => edit("input", (p) => ({ ...p, input: v }))} accent="var(--color-signal)" />
        <Meter read={playing ? audio.readInput : null} label="In" />
        <div className="flex items-end gap-2 border-l border-line pl-4">
          <StudioSwitch label="Gate" on={patch.gate.on} onChange={(on) => edit("gate.on", (p) => ({ ...p, gate: { ...p.gate, on } }))} />
          <StudioKnob label="Threshold" value={patch.gate.threshold} min={GATE_RANGE.min} max={GATE_RANGE.max} step={1} defaultValue={-70} format={(v) => `${v.toFixed(0)} dB`} disabled={!patch.gate.on} onChange={(v) => edit("gate.threshold", (p) => ({ ...p, gate: { ...p.gate, threshold: v } }))} accent="var(--color-signal)" />
        </div>
      </div>

      <div className="col-span-2 row-start-2 flex min-w-0 flex-col items-stretch gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:items-center">
        <PresetBar origin={origin} />
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-center">
          <IconBtn icon="arrow-up" label="Undo (⌘Z)" onClick={undo} disabled={!canUndo} rotate={-90} />
          <IconBtn icon="arrow-up" label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo} rotate={90} />
          <div role="group" aria-label="Compare" className="flex overflow-hidden rounded-full border border-line-strong">
            {(["A", "B"] as const).map((slot) => (
              <button key={slot} type="button" aria-pressed={active === slot} onClick={() => switchSlot(slot)} className={`focus-ring h-8 w-9 font-mono text-xs ${active === slot ? "bg-copper text-bg" : "text-muted hover:text-ink"}`}>{slot}</button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={copyToOther} title="Copy this side to the other">Copy to {active === "A" ? "B" : "A"}</Button>
          <Button size="sm" variant="ghost" onClick={reset} disabled={!dirty}>Reset</Button>
          {signedIn ? (
            <>
              {origin.isOwner && origin.toneId && <Button size="sm" variant="primary" icon="check" onClick={() => onSave("update")} disabled={!dirty}>Save</Button>}
              <Button size="sm" variant={origin.isOwner && origin.toneId ? "secondary" : "primary"} onClick={() => onSave("new")}>{origin.toneId && !origin.isOwner ? "Save as remix" : "Save as…"}</Button>
            </>
          ) : (
            <Link href="/login?callbackUrl=/studio" className="focus-ring inline-flex h-8 items-center rounded-full bg-copper px-3 font-body text-[13px] font-medium text-bg">Sign in to save</Link>
          )}
          {dirty && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber" aria-live="polite">Unsaved</span>}
        </div>
      </div>

      <div className="col-start-2 row-start-1 flex items-end justify-end gap-4 lg:col-start-3">
        <Meter read={playing ? audio.readOutput : null} label="Out" />
        <StudioKnob label="Output" value={patch.output} min={LEVEL_RANGE.min} max={LEVEL_RANGE.max} step={0.5} defaultValue={0} format={db} onChange={(v) => edit("output", (p) => ({ ...p, output: v }))} accent="var(--color-signal)" />
      </div>
    </div>
  );
}

function IconBtn({ icon, label, onClick, disabled, rotate = 0 }: { icon: "arrow-up"; label: string; onClick: () => void; disabled?: boolean; rotate?: number }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-dim hover:text-ink disabled:opacity-35">
      <Icon name={icon} size={16} style={{ transform: `rotate(${rotate}deg)` }} />
    </button>
  );
}

/** Factory starting points and your saved sounds; prev/next step through them. */
function PresetBar({ origin }: { origin: StudioOrigin }) {
  const store = useStudioStore();
  const device = useStudio((s) => s.device);
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const mine = useQuery({ ...presetsQuery(userId ?? ""), enabled: !!userId });
  const options = [
    ...(device ? [] : FACTORY_PRESETS.map((f) => ({ value: `factory:${f.id}`, label: f.name, group: "Factory" }))),
    ...(mine.data ?? []).map((p) => ({ value: `tone:${p.id}`, label: p.name, group: "Your sounds" })),
  ];
  const current = origin.toneId ? `tone:${origin.toneId}` : "";
  const [factory, setFactory] = useState("");
  const value = current || factory;
  const confirmLeave = useConfirmLeave();

  async function choose(v: string) {
    // Opening another sound replaces this one: ask if it has unsaved changes.
    if (!(await confirmLeave())) return;
    if (v.startsWith("factory:")) {
      const f = FACTORY_PRESETS.find((x) => `factory:${x.id}` === v);
      if (f) {
        setFactory(v);
        store.getState().load(f.patch);
      }
    } else if (v.startsWith("tone:")) {
      router.push(`/studio?tone=${v.slice(5)}`);
    }
  }
  const idx = options.findIndex((o) => o.value === value);
  const step = (d: number) => options.length && choose(options[(idx + d + options.length) % options.length].value);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button type="button" aria-label="Previous preset" onClick={() => step(-1)} className="focus-ring flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"><Icon name="chevron-left" size={18} /></button>
      <label className="min-w-0 flex-1 lg:w-[22rem] lg:flex-none">
        <span className="sr-only">Preset</span>
        <select value={value} onChange={(e) => choose(e.target.value)} className="focus-ring h-9 w-full truncate rounded-lg border border-line-strong bg-surface-2 px-3 font-body text-sm text-ink">
          {!value && <option value="">{origin.name}</option>}
          {current && !options.some((o) => o.value === current) && <option value={current}>{origin.name}</option>}
          {["Factory", "Your sounds"].map((g) => (
            <optgroup key={g} label={g}>{options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
          ))}
        </select>
      </label>
      <button type="button" aria-label="Next preset" onClick={() => step(1)} className="focus-ring flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"><Icon name="chevron-right" size={18} /></button>
    </div>
  );
}

// ── Signal chain navigation ────────────────────────────────────────────

function ChainNav({ fxFilter, setFxFilter }: { fxFilter: "pre" | "post"; setFxFilter: (f: "pre" | "post") => void }) {
  const store = useStudioStore();
  const view = useStudio((s) => s.view);
  const effects = useStudio((s) => s.patch.effects);
  const device = useStudio((s) => s.device);
  const pre = effects.filter((e) => EFFECT_DESIGNS[e.type].placement === "pre").length;
  const post = effects.length - pre;
  const go = (v: StudioView, f?: "pre" | "post") => {
    store.getState().setView(v);
    if (f) setFxFilter(f);
  };
  const steps: { id: string; label: string; detail: string; active: boolean; onClick: () => void; hidden?: boolean }[] = [
    { id: "pre", label: "Pedals", detail: `${pre} before the amp`, active: view === "fx" && fxFilter === "pre", onClick: () => go("fx", "pre"), hidden: !!device },
    { id: "amp", label: "Amp", detail: device ? "Device amp" : AMP_DESIGNS[store.getState().patch.amp.model].name, active: view === "amp", onClick: () => go("amp") },
    { id: "cab", label: "Cabinet", detail: "Speakers and mic", active: view === "cab", onClick: () => go("cab") },
    { id: "post", label: "Effects", detail: `${post} after the cab`, active: view === "fx" && fxFilter === "post", onClick: () => go("fx", "post") },
  ];
  return (
    <nav aria-label="Signal chain" className="flex items-stretch gap-1 overflow-x-auto px-4 py-2 scrollbar-none sm:justify-center sm:px-6">
      {steps.filter((s) => !s.hidden).map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="h-px w-4 bg-line-strong sm:w-8" />}
          <button type="button" onClick={s.onClick} aria-current={s.active ? "step" : undefined} className={`focus-ring flex min-w-[6.5rem] flex-col rounded-xl border px-3 py-2 text-left transition-colors ${s.active ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`}>
            <span className={`font-display text-sm font-semibold ${s.active ? "text-ink" : "text-ink-dim"}`}>{s.label}</span>
            <span className="truncate font-mono text-[10px] text-muted">{s.detail}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}

// ── Stage ──────────────────────────────────────────────────────────────

function Stage({ audio, onPower }: { audio: ReturnType<typeof useStudioAudio>; onPower: () => void }) {
  const store = useStudioStore();
  const patch = useStudio((s) => s.patch);
  const view = useStudio((s) => s.view);
  const lastEdit = useStudio((s) => s.lastEdit);
  const { knobs, switches } = useAmpControls();
  usePreferencesHydration();
  const pref = usePreferences((s) => s.scene3d);
  const setPref = usePreferences((s) => s.setScene3d);
  const supported = useSyncExternalStore(noSubscribe, webglAvailable, () => null);
  const lowPower = useSyncExternalStore(noSubscribe, lowPowerDevice, () => false);
  const decision = supported === null ? null : decideScene3d(pref, supported, lowPower);
  const show3d = decision === "render";
  const { edit } = store.getState();
  const readout = lastEdit ? describeEdit(lastEdit.key, patch) : null;

  return (
    <div className="relative isolate h-[min(56vh,560px)] min-h-[280px] overflow-hidden bg-[radial-gradient(90%_80%_at_50%_15%,#20242c_0%,#0c0d11_55%,#060709_100%)]">
      {show3d ? (
        <SceneBoundary fallback={<FlatStage patch={patch} />}>
          <StudioScene
            className="!absolute inset-0"
            patch={patch}
            view={view}
            knobs={knobs}
            switches={switches}
            powered={audio.status.state === "playing"}
            onKnob={(k, v) => edit(`amp.${k}`, (p) => ({ ...p, amp: { ...p.amp, [k]: v } }))}
            onSwitch={(k) => edit(`amp.${k}`, (p) => ({ ...p, amp: { ...p.amp, [k]: !p.amp[k] } }))}
            onPower={onPower}
            onMic={(v) => edit("cab.micPosition", (p) => ({ ...p, cab: { ...p.cab, micPosition: v } }))}
            onEffectParam={(id, k, v) => edit(`fx.${id}.${k}`, (p) => ({ ...p, effects: p.effects.map((e) => (e.id === id ? { ...e, params: { ...e.params, [k]: v } } : e)) }))}
            onEffectToggle={(id) => edit(`fx.${id}.on`, (p) => ({ ...p, effects: p.effects.map((e) => (e.id === id ? { ...e, on: !e.on } : e)) }))}
          />
        </SceneBoundary>
      ) : (
        <FlatStage patch={patch} />
      )}
      {readout && lastEdit && (
        // Restarts its fade on every edit (keyed by time), then disappears on its own.
        <div key={lastEdit.at} aria-hidden className="studio-readout pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-line-strong bg-bg/80 px-3 py-1 font-mono text-xs text-ink backdrop-blur">{readout}</div>
      )}
      <div className="absolute bottom-3 right-3 flex gap-2">
        {decision === "on-request" && <span className="self-center font-body text-[11px] text-muted">3D waits on this device to keep the controls quick.</span>}
        {supported && (
          <button type="button" onClick={() => setPref(show3d ? "off" : "on")} className="focus-ring rounded-full border border-line bg-bg/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted backdrop-blur hover:text-ink">
            {show3d ? "Hide 3D" : "Show 3D"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Without WebGL (or with 3D hidden), the stage still shows the rig as it's set. */
function FlatStage({ patch }: { patch: StudioPatch }) {
  const d = AMP_DESIGNS[patch.amp.model];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="label-engraved text-copper">{d.character}</p>
      <p className="font-display text-4xl font-semibold tracking-tight">{d.name}</p>
      <p className="max-w-md font-body text-sm text-muted">{d.tagline} · into a {CAB_DESIGNS[patch.cab.model].name}{patch.effects.length ? ` · ${patch.effects.length} effect${patch.effects.length > 1 ? "s" : ""}` : ""}</p>
    </div>
  );
}

// ── Decks: the full control set for the current view ───────────────────

function AmpDeck() {
  const store = useStudioStore();
  const patch = useStudio((s) => s.patch);
  const device = useStudio((s) => s.device);
  const { knobs, switches } = useAmpControls();
  const { edit } = store.getState();
  const design = AMP_DESIGNS[patch.amp.model];
  return (
    <div className="space-y-5">
      {device ? (
        <label className="block max-w-sm">
          <span className="label-engraved">{device.name} amp type</span>
          <select value={patch.device?.ampSlot} onChange={(e) => edit("device.amp", (p) => ({ ...p, device: { ...p.device!, ampSlot: Number(e.target.value) } }))} className="focus-ring mt-2 h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 font-body text-sm">
            {device.amps.map((a) => <option key={a.slot} value={a.slot}>{a.label}</option>)}
          </select>
        </label>
      ) : (
        <div role="radiogroup" aria-label="Amp" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {AMP_MODELS.map((m) => {
            const d = AMP_DESIGNS[m];
            const on = patch.amp.model === m;
            return (
              <button key={m} type="button" role="radio" aria-checked={on} onClick={() => edit("amp.model", (p) => ({ ...p, amp: { ...p.amp, model: m } }))} className={`focus-ring rounded-xl border p-3 text-left transition-colors ${on ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`}>
                <span className="block font-display text-sm font-semibold">{d.name}</span>
                <span className="mt-1 block font-body text-xs leading-snug text-muted">{d.tagline}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
        {switches.map((s) => <StudioSwitch key={s.key} label={s.label} on={patch.amp[s.key]} onChange={(v) => edit(`amp.${s.key}`, (p) => ({ ...p, amp: { ...p.amp, [s.key]: v } }))} />)}
        {knobs.map((k) => <StudioKnob key={k.key} label={k.label} value={patch.amp[k.key]} defaultValue={5} onChange={(v) => edit(`amp.${k.key}`, (p) => ({ ...p, amp: { ...p.amp, [k.key]: v } }))} />)}
      </div>
      <p className="max-w-2xl font-body text-xs leading-relaxed text-muted">
        {device ? `Edits the preset's ${device.name} settings within what the hardware has. ` : `${design.voicing} `}
        What you hear is Resoniq&apos;s own waveshaper and filters, not a model of any real amplifier.
      </p>
    </div>
  );
}

function CabDeck() {
  const store = useStudioStore();
  const cab = useStudio((s) => s.patch.cab);
  const device = useStudio((s) => s.device);
  const { edit } = store.getState();
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Cabinet" className="grid gap-2 sm:grid-cols-3">
        {CAB_MODELS.map((m) => {
          const d = CAB_DESIGNS[m];
          const on = cab.model === m;
          return (
            <button key={m} type="button" role="radio" aria-checked={on} onClick={() => edit("cab.model", (p) => ({ ...p, cab: { ...p.cab, model: m } }))} className={`focus-ring rounded-xl border p-3 text-left ${on ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`}>
              <span className="block font-display text-sm font-semibold">{d.name}</span>
              <span className="mt-1 block font-body text-xs text-muted">{d.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-6">
        {(!device || device.canBypassCab) && <StudioSwitch label="Cabinet" on={cab.on} onChange={(on) => edit("cab.on", (p) => ({ ...p, cab: { ...p.cab, on } }))} />}
        <StudioKnob label="Mic position" value={cab.micPosition} defaultValue={3} format={(v) => (v < 2 ? `${v.toFixed(1)} centre` : v > 8 ? `${v.toFixed(1)} edge` : v.toFixed(1))} onChange={(v) => edit("cab.micPosition", (p) => ({ ...p, cab: { ...p.cab, micPosition: v } }))} disabled={!cab.on} />
        <StudioKnob label="Mic distance" value={cab.micDistance} defaultValue={2} onChange={(v) => edit("cab.micDistance", (p) => ({ ...p, cab: { ...p.cab, micDistance: v } }))} disabled={!cab.on} />
      </div>
      <p className="max-w-2xl font-body text-xs leading-relaxed text-muted">
        Moving the mic toward the speaker&apos;s edge darkens the top end; backing it off loses close-mic bass. The cabinet is a filter approximation, not an impulse response of a real speaker.
        {device && " On the hardware, choose the matching IR slot."}
      </p>
    </div>
  );
}

function FxDeck({ placement }: { placement: "pre" | "post" }) {
  const store = useStudioStore();
  const effects = useStudio((s) => s.patch.effects);
  const device = useStudio((s) => s.device);
  const { edit } = store.getState();
  const shown = effects.filter((e) => EFFECT_DESIGNS[e.type].placement === placement);
  const allowed: EffectType[] = device
    ? device.effectSlots.filter((slot) => !effects.some((e) => slot.types.includes(e.type))).flatMap((s) => s.types)
    : EFFECT_TYPES.filter((t) => EFFECT_DESIGNS[t].placement === placement);
  const move = (id: string, d: number) =>
    edit("fx.order", (p) => {
      const group = p.effects.filter((e) => EFFECT_DESIGNS[e.type].placement === placement);
      const i = group.findIndex((e) => e.id === id);
      const j = i + d;
      if (j < 0 || j >= group.length) return p;
      [group[i], group[j]] = [group[j], group[i]];
      const other = p.effects.filter((e) => EFFECT_DESIGNS[e.type].placement !== placement);
      return { ...p, effects: orderEffects(placement === "pre" ? [...group, ...other] : [...other, ...group]) };
    });
  return (
    <div className="space-y-4">
      {shown.length === 0 && <p className="font-body text-sm text-muted">{placement === "pre" ? "Nothing before the amp. Add a compressor or a drive to push it." : "Nothing after the cabinet. Add modulation, delay or reverb."}</p>}
      <ol className="space-y-3">
        {shown.map((e, i) => {
          const d = EFFECT_DESIGNS[e.type];
          const params = device?.effectParams[e.type] ?? d.params;
          const voices = device?.voices[e.type] ?? d.voices;
          return (
            <li key={e.id} className="rounded-2xl border border-line bg-surface/60 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: d.color, boxShadow: e.on ? `0 0 10px ${d.color}` : "none" }} />
                <span className="font-display text-base font-semibold">{d.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{e.type}</span>
                <span className="ml-auto flex items-center gap-1">
                  {!device && (
                    <>
                      <button type="button" aria-label={`Move ${d.name} earlier`} disabled={i === 0} onClick={() => move(e.id, -1)} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-30"><Icon name="chevron-left" size={16} /></button>
                      <button type="button" aria-label={`Move ${d.name} later`} disabled={i === shown.length - 1} onClick={() => move(e.id, 1)} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-30"><Icon name="chevron-right" size={16} /></button>
                    </>
                  )}
                  <button type="button" aria-label={`Remove ${d.name}`} onClick={() => edit("fx.remove", (p) => ({ ...p, effects: p.effects.filter((x) => x.id !== e.id) }))} className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-danger"><Icon name="trash" size={16} /></button>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-5">
                {!device && <StudioSwitch label="On" on={e.on} onChange={(on) => edit(`fx.${e.id}.on`, (p) => ({ ...p, effects: p.effects.map((x) => (x.id === e.id ? { ...x, on } : x)) }))} />}
                {voices && (
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Type</span>
                    <select value={e.voice} onChange={(ev) => edit(`fx.${e.id}.voice`, (p) => ({ ...p, effects: p.effects.map((x) => (x.id === e.id ? { ...x, voice: ev.target.value } : x)) }))} className="focus-ring h-9 rounded-lg border border-line-strong bg-surface-2 px-2 font-body text-sm">
                      {voices.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </label>
                )}
                {params.map((p) => (
                  <StudioKnob key={p.key} label={p.label} value={e.params[p.key]} defaultValue={d.params.find((x) => x.key === p.key)?.default} size={48} onChange={(v) => edit(`fx.${e.id}.${p.key}`, (pp) => ({ ...pp, effects: pp.effects.map((x) => (x.id === e.id ? { ...x, params: { ...x.params, [p.key]: v } } : x)) }))} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {allowed.length > 0 && effects.length < MAX_EFFECTS && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Add</span>
          {allowed.map((t) => (
            <button key={t} type="button" onClick={() => edit("fx.add", (p) => ({ ...p, effects: orderEffects([...p.effects, newEffect(t)]) }))} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 font-body text-[13px] text-ink-dim hover:border-copper/50 hover:text-ink">
              <Icon name="plus" size={14} /> {EFFECT_DESIGNS[t].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transport: what's feeding the chain ────────────────────────────────

function Transport({ audio }: { audio: ReturnType<typeof useStudioAudio> }) {
  const [source, setSource] = useState<SourceKind>("demo");
  const [file, setFile] = useState<File | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const playing = audio.status.state === "playing";
  async function listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch {
      setDevices([]);
    }
  }
  const go = () => (playing ? audio.stop() : void audio.start(source, file ?? undefined, deviceId || undefined));
  return (
    <div className="flex flex-col gap-3 border-t border-line bg-[#0b0c10] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
      <div role="radiogroup" aria-label="Sound source" className="flex overflow-hidden rounded-full border border-line-strong">
        {([["demo", "Demo riff"], ["file", "Your file"], ["live", "Live input"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={source === k} onClick={() => { setSource(k); if (k === "live") void listDevices(); if (playing) audio.stop(); }} className={`focus-ring h-9 px-3 font-body text-[13px] ${source === k ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"}`}>{label}</button>
        ))}
      </div>
      {source === "file" && (
        <label className="flex min-w-0 items-center gap-2 font-body text-[13px] text-muted">
          <span className="sr-only">Audio file</span>
          <input type="file" accept="audio/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (playing) audio.stop(); }} className="max-w-[16rem] text-[12px] file:mr-2 file:rounded-full file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink" />
        </label>
      )}
      {source === "live" && (
        <label className="flex items-center gap-2 font-body text-[13px] text-muted">
          Input
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="focus-ring h-9 max-w-[14rem] rounded-lg border border-line-strong bg-surface-2 px-2 text-ink">
            <option value="">Default input</option>
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Input ${i + 1}`}</option>)}
          </select>
        </label>
      )}
      <Button variant={playing ? "secondary" : "signal"} icon={playing ? "pause" : "play"} onClick={go} disabled={audio.status.state === "starting" || (source === "file" && !file)}>
        {audio.status.state === "starting" ? "Starting…" : playing ? "Stop" : source === "live" ? "Play live" : "Play"}
      </Button>
      <p role="status" aria-live="polite" className="min-w-0 flex-1 font-body text-xs text-muted">
        {audio.status.message ??
          (playing
            ? source === "live"
              ? `Live. About ${audio.status.latencyMs ?? "?"} ms of browser latency; use headphones to avoid feedback.`
              : "Looping. Turn anything: you're hearing it change."
            : source === "file"
              ? "Your file stays on this device. A dry DI track shows the amp best."
              : source === "live"
                ? "Plug in through an audio interface. Nothing is recorded or uploaded."
                : "A synthesized DI riff, generated in your browser.")}
      </p>
      <details className="w-full font-body text-xs text-muted sm:w-auto">
        <summary className="cursor-pointer select-none text-ink-dim hover:text-ink">What you&apos;re hearing</summary>
        <p className="mt-2 max-w-xl leading-relaxed">
          Real Web Audio processing: input and output gain, a noise gate driven by a level detector, compression, a soft-clipping drive,
          the amp as two waveshaper stages with tone-stack filters voiced per design, a filter-based cabinet that responds to mic
          placement, chorus, phaser, tremolo, delay and convolution reverb, then a safety limiter. It&apos;s Resoniq&apos;s own
          processing: none of it models a real amplifier, pedal or speaker, and a hardware preset will sound different on the device.
        </p>
      </details>
    </div>
  );
}

// ── Save dialog ────────────────────────────────────────────────────────

function SaveDialog({ open, mode, initialName, pending, error, onClose, onSave }: { open: boolean; mode: SaveMode; initialName: string; pending: boolean; error: string | null; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  return (
    <Dialog open={open} title={mode === "update" ? "Save changes" : "Save as a new sound"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(name.trim() || initialName); }} className="space-y-4">
        <label className="block">
          <span className="label-engraved">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-base outline-none" />
        </label>
        <p className="font-body text-xs text-muted">{mode === "new" ? "New sounds are private until you choose to share them." : "Updates this sound in place."}</p>
        {error && <p role="alert" className="font-body text-sm text-danger">{error} Your edits are still here.</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── The studio ─────────────────────────────────────────────────────────

export type StudioAppProps = {
  initial: { studio: StudioPatch | null; declared: import("@/types/rig").RigSpec | null; inferred: import("@/types/tone").RecipeCore | null };
  origin: StudioOrigin;
  context?: ReactNode;
  /** Arrived here straight after saving this sound for the first time. */
  justSaved?: boolean;
};

function Shortcuts({ onSave, toggle }: { onSave: () => void; toggle: () => void }) {
  const store = useStudioStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable=true]");
      const mod = e.metaKey || e.ctrlKey;
      const s = store.getState();
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); s.redo(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); onSave(); return; }
      if (typing || mod || e.altKey || el.getAttribute("role") === "slider") return;
      if (e.key === "1") s.setView("amp");
      else if (e.key === "2") s.setView("cab");
      else if (e.key === "3") s.setView("fx");
      else if (e.key.toLowerCase() === "c") s.switchSlot(s.active === "A" ? "B" : "A");
      else if (e.key === " ") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, onSave, toggle]);
  return null;
}

export default function StudioApp({ initial, origin, context, justSaved = false }: StudioAppProps) {
  const opened = useMemo(() => patchFromTone(initial), [initial]);
  const [store] = useState(() => createStudioStore(opened.patch, opened.device as StudioDevice | null));
  return (
    <StoreContext.Provider value={store}>
      <Studio origin={origin} from={opened.from} context={context} justSaved={justSaved} />
    </StoreContext.Provider>
  );
}

function Studio({ origin, from, context, justSaved }: { origin: StudioOrigin; from: string; context?: ReactNode; justSaved: boolean }) {
  const store = useStudioStore();
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const audio = useStudioAudio(store);
  const view = useStudio((s) => s.view);
  const device = useStudio((s) => s.device);
  const dirty = useStudio(isDirty);
  const [fxFilter, setFxFilter] = useState<"pre" | "post">(device ? "post" : "pre");
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const [savedTone, setSavedTone] = useState<{ id: string; name: string; created: boolean } | null>(() => (justSaved && origin.toneId ? { id: origin.toneId, name: origin.name, created: true } : null));
  // The flag only says what just happened; a reload shouldn't repeat it.
  useEffect(() => {
    if (!justSaved) return;
    const url = new URL(location.href);
    url.searchParams.delete("saved");
    history.replaceState(history.state, "", url);
  }, [justSaved]);
  const save = useSaveStudio(userId ?? "");

  // Closing the tab, following a link or opening another sound asks first. A sound you own saves in place from the prompt.
  const canUpdate = !!userId && origin.isOwner && !!origin.toneId;
  useUnsavedChanges({
    dirty,
    label: "your studio sound",
    save: canUpdate ? async () => {
      const patch = store.getState().patch;
      await save.mutateAsync({ patch, origin, mode: "update", name: origin.name });
      store.getState().markSaved(patch);
    } : undefined,
  });

  // The amp's power switch: stop, or start again from the last source (a file needs picking again, so the demo stands in).
  const togglePower = () => (audio.status.state === "playing" ? audio.stop() : void audio.start(audio.status.source && audio.status.source !== "file" ? audio.status.source : "demo"));
  const requestSave = (mode: SaveMode) => {
    if (!userId) return router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname + location.search)}`);
    save.reset();
    setSaving(mode);
  };

  return (
    <div className="-mx-4 -mt-5 overflow-hidden border-b border-line sm:-mx-6 lg:-mx-8 lg:-mt-8">
      <Shortcuts onSave={() => requestSave(origin.isOwner && origin.toneId ? "update" : "new")} toggle={togglePower} />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-6">
        <h1 className="font-display text-lg font-semibold tracking-tight">Amp Studio</h1>
        <p className="min-w-0 flex-1 truncate font-body text-sm text-muted">
          {origin.name}
          {from === "analysis" && " · started from Resoniq's analysis"}
          {from === "rig" && " · started from the creator's declared rig"}
          {device && ` · ${device.name} preset`}
        </p>
        {context}
      </header>
      <Rack audio={audio} origin={origin} signedIn={!!userId} onSave={requestSave} />
      {savedTone && (
        // What to do with a sound once it's saved: the rest of Resoniq, one tap away.
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-signal/30 bg-signal/[0.07] px-4 py-2.5 sm:px-6">
          <p className="mr-auto font-body text-sm"><span className="text-signal">Saved</span> <span className="text-ink">{savedTone.name}</span> <span className="text-muted">{savedTone.created ? "to your tone vault, private until you share it." : "changes saved."}</span></p>
          <Link href={`/new?tone=${savedTone.id}&category=TONE_COMPARISON`} className="focus-ring rounded-full bg-copper px-3 py-1 font-body text-[13px] font-medium text-bg hover:bg-copper-soft">Post it</Link>
          <Link href={`/practice?tone=${savedTone.id}`} className="focus-ring font-body text-[13px] text-ink-dim hover:text-ink">Practice with it</Link>
          <Link href={`/t/${savedTone.id}`} className="focus-ring font-body text-[13px] text-ink-dim hover:text-ink">Tone page</Link>
          <button type="button" onClick={() => setSavedTone(null)} aria-label="Dismiss" className="focus-ring rounded-full p-1 text-muted hover:text-ink"><Icon name="close" size={14} /></button>
        </div>
      )}
      <ChainNav fxFilter={fxFilter} setFxFilter={setFxFilter} />
      <Stage audio={audio} onPower={togglePower} />
      <section aria-label="Controls" className="bg-[#0d0e12] px-4 py-6 sm:px-6">
        {view === "amp" ? <AmpDeck /> : view === "cab" ? <CabDeck /> : <FxDeck placement={device ? "post" : fxFilter} />}
        {device && (
          <ul className="mt-6 space-y-1 border-t border-line pt-4 font-body text-xs text-muted">
            {device.caveats.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
      </section>
      <Transport audio={audio} />
      <p className="sr-only">Keyboard: 1 amp, 2 cabinet, 3 effects, C compare A and B, Space play or stop, Command or Control Z undo, Shift Command Z redo, Command S save.</p>
      <SaveDialog
        key={saving ?? "closed"}
        open={saving !== null}
        mode={saving ?? "new"}
        initialName={saving === "update" ? origin.name : origin.toneId ? `${origin.name} (studio)` : "My studio sound"}
        pending={save.isPending}
        error={save.error ? errorMessage(save.error) : null}
        onClose={() => setSaving(null)}
        onSave={(name) => {
          const patch = store.getState().patch;
          save.mutate(
            { patch, origin, mode: saving ?? "new", name },
            {
              onSuccess: ({ id, name: saved }) => {
                store.getState().markSaved(patch);
                setSaving(null);
                setSavedTone({ id, name: saved, created: id !== origin.toneId });
                if (id !== origin.toneId) router.replace(`/studio?tone=${id}&saved=1`);
                else router.refresh();
              },
            },
          );
        }}
      />
    </div>
  );
}
