import { AMP_DESIGNS, CAB_DESIGNS, EFFECT_DESIGNS, MIC_DESIGNS, SPEAKER_DESIGNS, type StudioPatch } from "@/lib/studio/patch";
import { DNA_AXES, type ToneDna } from "@/lib/tone-dna";

/**
 * A shareable image of a tone's settings (rendered by next/og, so every
 * element with several children is a flex box). Values are the tone's real
 * settings; the provenance line says where they came from.
 */
export const CARD_FORMATS = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  wide: { width: 1200, height: 630 },
} as const;
export type CardFormat = keyof typeof CARD_FORMATS;

const C = { bg: "#0A0D12", panel: "#151A22", line: "#343D4C", ink: "#F3EFE8", muted: "#8B93A1", copper: "#FF8A3D", signal: "#37E6C9" };

const PROVENANCE: Record<string, string> = {
  studio: "Dialled in the Resoniq Amp Studio",
  device: "A hardware preset, as edited in Resoniq",
  analysis: "Estimated from a recording by Resoniq's analysis",
  rig: "From the creator's declared rig",
  default: "Studio starting point",
};

function Knob({ label, value, s }: { label: string; value: number; s: number }) {
  const d = 64 * s;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * s, width: 88 * s }}>
      <div style={{ display: "flex", width: d, height: d, borderRadius: 999, background: "radial-gradient(circle at 40% 30%, #3a3f48, #0b0c0f)", border: `2px solid ${C.line}`, justifyContent: "center", transform: `rotate(${(value / 10) * 270 - 135}deg)` }}>
        <div style={{ display: "flex", width: 4 * s, height: d * 0.4, marginTop: 4 * s, borderRadius: 4, background: C.copper }} />
      </div>
      <div style={{ display: "flex", fontSize: 18 * s, letterSpacing: 2, color: C.muted }}>{label.toUpperCase()}</div>
      <div style={{ display: "flex", fontSize: 26 * s, color: C.ink }}>{value.toFixed(1)}</div>
    </div>
  );
}

export function ToneCard({ format, name, by, patch, from, dna, url, device }: { format: CardFormat; name: string; by: string; patch: StudioPatch; from: string; dna: ToneDna; url: string; device: string | null }) {
  const wide = format === "wide";
  const s = wide ? 0.72 : format === "story" ? 1.2 : 0.86;
  const amp = AMP_DESIGNS[patch.amp.model];
  const cab = CAB_DESIGNS[patch.cab.model];
  const on = patch.effects.filter((e) => e.on);
  const pedals = (side: "pre" | "post") => on.filter((e) => (side === "pre" ? e.placement === "pre" : e.placement !== "pre"));
  const chip = (text: string, color: string) => (
    <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 * s, padding: `${8 * s}px ${16 * s}px`, borderRadius: 999, border: `2px solid ${C.line}`, fontSize: 22 * s, color: C.ink }}>
      <div style={{ display: "flex", width: 14 * s, height: 14 * s, borderRadius: 999, background: color }} />
      {text}
    </div>
  );
  const rig = (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 * s, ...(wide && { flex: 1 }) }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 * s, padding: 26 * s, borderRadius: 24, background: C.panel, border: `2px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 34 * s, fontWeight: 700 }}>{device ?? amp.name}</div>
          <div style={{ display: "flex", fontSize: 18 * s, letterSpacing: 3, color: C.copper }}>{device ? "DEVICE PRESET" : amp.character.toUpperCase().replace("-", " ")}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 * s }}>
          {amp.knobs.map((k) => <Knob key={k.key} label={k.label} value={patch.amp[k.key]} s={s} />)}
        </div>
        <div style={{ display: "flex", fontSize: 22 * s, color: C.muted }}>
          {patch.cab.on ? `${cab.name} · ${SPEAKER_DESIGNS[patch.cab.speaker].name} speaker · ${MIC_DESIGNS[patch.cab.mic].name} mic` : "Cabinet bypassed"}
        </div>
      </div>
      {on.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 * s }}>
          {pedals("pre").map((e) => chip(EFFECT_DESIGNS[e.type].name, EFFECT_DESIGNS[e.type].color))}
          {chip(device ?? amp.name, C.copper)}
          {pedals("post").map((e) => chip(EFFECT_DESIGNS[e.type].name, EFFECT_DESIGNS[e.type].color))}
        </div>
      )}
    </div>
  );
  const strand = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 * s, width: wide ? 380 : "100%" }}>
      <div style={{ display: "flex", fontSize: 20 * s, letterSpacing: 4, color: C.muted }}>TONE DNA · ESTIMATED FROM SETTINGS</div>
      {DNA_AXES.map((ax) => (
        <div key={ax.key} style={{ display: "flex", alignItems: "center", gap: 16 * s }}>
          <div style={{ display: "flex", width: 170 * s, fontSize: 20 * s, color: C.muted }}>{ax.label}</div>
          <div style={{ display: "flex", flex: 1, height: 14 * s, borderRadius: 999, background: "#06080B", border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", width: `${Math.max(3, dna[ax.key] * 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.signal}, ${C.copper})` }} />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 28 * s, padding: (wide ? 44 : 72) * s, background: `radial-gradient(circle at 12% 10%, #3A2214, ${C.bg} 55%)`, color: C.ink, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 30 * s, letterSpacing: 6, fontWeight: 700 }}>RESONIQ</div>
        <div style={{ display: "flex", fontSize: 20 * s, letterSpacing: 4, color: C.copper }}>TONE CARD</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 * s }}>
        <div style={{ display: "flex", fontSize: (name.length > 34 ? 56 : 72) * s, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
        <div style={{ display: "flex", fontSize: 28 * s, color: C.muted }}>{by}</div>
      </div>
      <div style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: (format === "story" ? 90 : 34) * s, ...(wide && { flex: 1 }) }}>
        {rig}
        {strand}
      </div>
      <div style={{ display: "flex", flexDirection: format === "story" ? "column" : "row", gap: 8 * s, justifyContent: "space-between", alignItems: format === "story" ? "flex-start" : "flex-end", fontSize: 22 * s, color: C.muted }}>
        <div style={{ display: "flex" }}>{PROVENANCE[from] ?? PROVENANCE.default}</div>
        <div style={{ display: "flex", color: C.ink }}>{url.replace(/^https?:\/\//, "")}</div>
      </div>
    </div>
  );
}
