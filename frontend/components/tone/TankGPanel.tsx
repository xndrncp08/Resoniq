import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { buttonClass } from "@/components/app/ui";
import { TANK_G_SLUG, tankGSheet } from "@/lib/devices/tank-g";
import type { RigSpec } from "@/types/rig";

/** One panel knob; multi-zone knobs and selectors show their setting as text. */
function Knob({ label, value, text }: { label: string; value: number | null; text: string }) {
  const angle = value === null ? 0 : -150 + (value / 10) * 300;
  return (
    <li className="flex flex-col items-center gap-1.5 text-center">
      <svg viewBox="0 0 40 40" className="h-11 w-11 text-copper" aria-hidden>
        <circle cx="20" cy="20" r="15" fill="#0E1218" stroke="rgba(255,255,255,.16)" />
        <circle cx="20" cy="20" r="11" fill="#161C24" />
        {value !== null && <line x1="20" y1="20" x2="20" y2="9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${angle} 20 20)`} />}
        {value === null && <circle cx="20" cy="20" r="2.5" fill="currentColor" />}
      </svg>
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</span>
      <span className="font-mono text-[11px] leading-tight text-ink">{text}</span>
    </li>
  );
}

/** The TANK-G faceplate, a knob-by-knob setup sheet, and honest export options. */
export default function TankGPanel({ toneId, rig }: { toneId: string; rig: RigSpec }) {
  const rows = tankGSheet(rig);
  if (!rows.length) return null;
  const num = (setting: string) => (/^\d+(\.\d+)?$/.test(setting) ? Number(setting) : null);
  return (
    <section aria-labelledby="tank-g-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tank-g-h" className="font-display text-2xl font-semibold">M-VAVE TANK-G settings</h2>
        <Link href={`/gear/${TANK_G_SLUG}`} className="font-body text-sm text-copper hover:underline">More TANK-G presets</Link>
      </div>
      <div className="panel grille relative overflow-hidden p-5 sm:p-6">
        <p className="label-engraved mb-4">Panel · LIVE mode</p>
        <ol aria-label="TANK-G panel settings" className="grid grid-cols-3 gap-x-2 gap-y-5 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
          {rows.map((r) => <Knob key={r.control} label={r.control} value={num(r.setting)} text={r.setting} />)}
        </ol>
      </div>
      <div className="panel-inset overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[480px] text-left font-body text-sm">
          <caption className="label-engraved px-4 pt-4 text-left">Setup sheet</caption>
          <thead><tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted"><th scope="col" className="px-4 py-2">Control</th><th scope="col" className="px-4 py-2">Setting</th><th scope="col" className="px-4 py-2">Approximate position</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.control} className="border-b border-line/60 last:border-0"><th scope="row" className="px-4 py-2 font-mono text-xs text-ink">{r.control}</th><td className="px-4 py-2 tabular-nums text-ink-dim">{r.setting}</td><td className="px-4 py-2 text-muted">{r.position}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="max-w-3xl font-body text-sm text-muted">
        Values are normalized 0–10 knob positions (5 ≈ noon) on a panel with no printed scale, not native parameter readouts. Multi-zone knobs (MOD FX, DLY MIX, RVB DECAY) pick their effect by zone and switch the module off between zones; the module lights tell you which zone you are in. Amp voicings and IR names can change with firmware.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/tones/${toneId}/export?format=sheet`} className={buttonClass("secondary", "md")}><Icon name="download" size={18} /> Setup sheet (.txt)</a>
        <a href={`/api/tones/${toneId}/export`} className={buttonClass("ghost", "md")}><Icon name="download" size={18} /> Resoniq JSON</a>
      </div>
      <p className="font-body text-xs text-muted">Neither file is a native M-EFCS preset: M-VAVE&apos;s preset format isn&apos;t documented, so Resoniq doesn&apos;t write one.</p>
    </section>
  );
}
