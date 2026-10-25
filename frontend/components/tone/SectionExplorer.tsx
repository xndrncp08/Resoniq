"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import { Button } from "@/components/app/ui";
import ToneDashboard from "@/components/tone/ToneDashboard";
import GearSuggestions from "@/components/tone/GearSuggestions";
import type { EngineAnalysis, EngineSection } from "@/types/engine";
import { recipeCoreFromAnalysis, recipeFromAnalysis, sectionAnalysis, songAudioUrl, type SongMeta } from "@/lib/tone-recipe";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const TYPE_COLORS: Record<string, string> = { A: "#ff8a3d", B: "#37e6c9", C: "#b48cff", D: "#ffc24d" };

/** Spectral centre → colour: dark teal (dark mixes) through copper to pale gold (bright ones). */
function brightnessColor(hz: number) {
  const t = Math.max(0, Math.min(1, Math.log(Math.max(hz, 300) / 300) / Math.log(5000 / 300)));
  const stops = [[18, 82, 76], [28, 143, 125], [255, 138, 61], [255, 214, 176]];
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const [r, g, b] = stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
  return `rgb(${r},${g},${b})`;
}

function Timeline({ data, selected, onSelect, audioRef, playingRange }: { data: EngineAnalysis; selected: string; onSelect: (id: string) => void; audioRef: React.RefObject<HTMLAudioElement | null>; playingRange: [number, number] | null }) {
  const tl = data.timeline!;
  const sections = data.sections!;
  const total = sections.at(-1)!.end_s;
  const W = 1000;
  const H = 120;
  const x = (s: number) => (s / total) * W;
  const y = (db: number) => H - Math.max(0, Math.min(1, (db + 60) / 60)) * (H - 8);
  const area = useMemo(() => {
    const pts = tl.rms_db.map((db, i) => `${((i + 0.5) * tl.step_s / total) * W},${y(db)}`);
    return `M0,${H} L${pts.join(" L")} L${W},${H} Z`;
  }, [tl, total]);
  const playhead = useRef<SVGLineElement>(null);

  // Follow the audio with the playhead, straight to the DOM.
  useEffect(() => {
    if (!playingRange) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a && playhead.current) {
        const px = (a.currentTime / total) * W;
        playhead.current.setAttribute("x1", String(px));
        playhead.current.setAttribute("x2", String(px));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playingRange, audioRef, total]);

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="h-auto w-full touch-none select-none" role="img" aria-label={`Loudness and brightness over ${clock(total)}, with ${sections.length} sections`}>
        {sections.map((s) => (
          <rect key={s.id} x={x(s.start_s)} y={0} width={x(s.end_s) - x(s.start_s)} height={H} fill={TYPE_COLORS[s.type]} opacity={s.id === selected ? 0.16 : 0.05} onClick={() => onSelect(s.id)} className="cursor-pointer" />
        ))}
        <path d={area} fill="url(#loud)" stroke="rgba(243,239,232,0.5)" strokeWidth={1} pointerEvents="none" />
        <defs>
          <linearGradient id="loud" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(243,239,232,0.35)" />
            <stop offset="100%" stopColor="rgba(243,239,232,0.03)" />
          </linearGradient>
        </defs>
        {tl.centroid_hz.map((hz, i) => (
          <rect key={i} x={((i * tl.step_s) / total) * W} y={H + 4} width={Math.max(1, (tl.step_s / total) * W) + 0.5} height={8} fill={brightnessColor(hz)} pointerEvents="none" />
        ))}
        {sections.map((s) => (
          <g key={`${s.id}-label`} pointerEvents="none">
            <line x1={x(s.start_s)} x2={x(s.start_s)} y1={0} y2={H + 12} stroke="rgba(255,255,255,0.18)" />
            <text x={x(s.start_s) + 6} y={16} className="font-mono" fontSize={13} fill={TYPE_COLORS[s.type]} fontWeight={s.id === selected ? 700 : 500}>{s.type}</text>
          </g>
        ))}
        {playingRange && <line ref={playhead} x1={0} x2={0} y1={0} y2={H + 12} stroke="#f3efe8" strokeWidth={2} />}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={Math.min(W - 30, f * W)} y={H + 25} fontSize={11} className="font-mono" fill="rgba(139,147,161,0.9)" textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}>{clock(f * total)}</text>
        ))}
      </svg>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        <span>Shape: loudness (measured)</span>
        <span className="flex items-center gap-1.5">Band: brightness <span className="h-2 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${brightnessColor(300)}, ${brightnessColor(1200)}, ${brightnessColor(2500)}, ${brightnessColor(5000)})` }} /> dark → bright</span>
      </p>
    </div>
  );
}

function Bar({ label, value, min, max, unit }: { label: string; value: number; min: number; max: number; unit: string }) {
  const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <div>
      <div className="flex justify-between font-mono text-[11px]"><span className="text-muted">{label}</span><span className="tabular-nums text-ink">{value.toFixed(unit === "Hz" ? 0 : 1)} {unit}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-0"><div className="h-full rounded-full bg-signal" style={{ width: `${f * 100}%` }} /></div>
    </div>
  );
}

function Delta({ label, a, b, unit, better }: { label: string; a: number; b: number; unit: string; better: [string, string] }) {
  const d = a - b;
  const big = Math.abs(d) >= (unit === "Hz" ? 120 : 1);
  return (
    <li className="flex justify-between gap-3 font-body text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{big ? `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(unit === "Hz" ? 0 : 1)} ${unit} ${d > 0 ? better[0] : better[1]}` : "about the same"}</span>
    </li>
  );
}

function SectionDetail({ section, main }: { section: EngineSection; main: EngineSection | undefined }) {
  const c = section.character;
  const p = section.tone_profile;
  const r = section.recipe;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="panel p-5" aria-label="Measured">
        <p className="label-engraved text-signal">Measured</p>
        <p className="mt-1 font-body text-xs text-muted">Read straight from the audio of this section (the whole mix).</p>
        <div className="mt-4 space-y-3">
          <Bar label="Level" value={c.rms_db} min={-60} max={0} unit="dBFS" />
          <Bar label="Spectral centre" value={c.centroid_hz} min={200} max={5000} unit="Hz" />
          <Bar label="Low band" value={c.low_db} min={-40} max={0} unit="dB" />
          <Bar label="Mid band" value={c.mid_db} min={-40} max={0} unit="dB" />
          <Bar label="High band" value={c.high_db} min={-40} max={0} unit="dB" />
        </div>
        {section.traits.length > 0 && <p className="mt-4 font-body text-sm text-ink-dim">Compared with the rest: {section.traits.join(", ")}.</p>}
      </section>
      <section className="panel p-5" aria-label="Estimated">
        <p className="label-engraved text-amber">Estimated</p>
        <p className="mt-1 font-body text-xs text-muted">Inferred from the measurements with rules of thumb. Closest match, heuristic confidence {p.match_confidence}%.</p>
        <dl className="mt-4 space-y-2 font-body text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Amp character</dt><dd className="text-right">{p.amp_family}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Gain</dt><dd>about {p.gain_percent}%</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Cabinet</dt><dd className="text-right">{p.cabinet}</dd></div>
          {p.effects_chain.map((e) => <div key={e.name} className="flex justify-between gap-3"><dt className="text-muted">{e.name}</dt><dd>{Math.round(e.confidence * 100)}% likely</dd></div>)}
        </dl>
        {main && main.id !== section.id && (
          <>
            <p className="mt-5 label-engraved">Against the main sound ({main.type})</p>
            <ul className="mt-2 space-y-1.5">
              <Delta label="Level" a={c.rms_db} b={main.character.rms_db} unit="dB" better={["louder", "quieter"]} />
              <Delta label="Brightness" a={c.centroid_hz} b={main.character.centroid_hz} unit="Hz" better={["brighter", "darker"]} />
              <Delta label="Low end" a={c.low_db} b={main.character.low_db} unit="dB" better={["more", "less"]} />
              <Delta label="Density" a={c.flatness_db} b={main.character.flatness_db} unit="dB" better={["denser", "sparser"]} />
            </ul>
          </>
        )}
      </section>
      <section className="panel p-5" aria-label="Recommended">
        <p className="label-engraved text-copper">Recommended starting point</p>
        <p className="mt-2 text-pretty font-body text-sm leading-relaxed text-ink-dim">{r.recipeDescription}</p>
        <p className="mt-3 font-mono text-[11px] text-muted">Gain {r.amp.gain} · Bass {r.amp.bass} · Mids {r.amp.mids} · Treble {r.amp.treble} (0–100)</p>
        <p className="mt-3 font-body text-xs text-muted">A full mix can&apos;t reveal the exact amp or pedals. These are settings to start from and tune by ear.</p>
      </section>
    </div>
  );
}

/**
 * A long recording, section by section: a timeline of what was measured,
 * each kind of sound's measurements, estimates and recommendations kept
 * apart, its settings on the musician's own gear, and an editable rig.
 */
export default function SectionExplorer({ song, data }: { song: SongMeta; data: EngineAnalysis }) {
  const sections = data.sections!;
  const main = sections.find((s) => s.id === data.main_section) ?? sections[0];
  const [selected, setSelected] = useState(main.id);
  const audio = useRef<HTMLAudioElement>(null);
  const [playingRange, setPlayingRange] = useState<[number, number] | null>(null);
  const section = sections.find((s) => s.id === selected)!;
  const analysis = useMemo(() => sectionAnalysis(data, selected)!, [data, selected]);
  const recipe = useMemo(() => recipeFromAnalysis(analysis, song), [analysis, song]);
  const core = useMemo(() => recipeCoreFromAnalysis(analysis), [analysis]);
  const types = [...new Set(sections.map((s) => s.type))];

  // Stop at the end of the section being auditioned.
  useEffect(() => {
    const a = audio.current;
    if (!a || !playingRange) return;
    const onTime = () => { if (a.currentTime >= playingRange[1]) { a.pause(); setPlayingRange(null); } };
    const onPause = () => setPlayingRange(null);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("pause", onPause);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("pause", onPause); };
  }, [playingRange]);

  async function audition(s: EngineSection) {
    const a = audio.current;
    if (!a) return;
    if (playingRange && playingRange[0] === s.start_s) return a.pause();
    a.currentTime = s.start_s;
    setPlayingRange([s.start_s, s.end_s]);
    await a.play().catch(() => setPlayingRange(null));
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="timeline-h" className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="timeline-h" className="font-display text-xl font-semibold">{types.length} distinct sounds across {sections.length} sections</h2>
          <span className="label-engraved">Measured timeline</span>
        </div>
        <p className="mt-1 max-w-2xl font-body text-sm text-muted">Resoniq found where the sound changes (level and tone colour of the whole mix) and measured each kind of sound on its own excerpt. Sections sharing a letter sound alike.</p>
        <div className="mt-5">
          <Timeline data={data} selected={selected} onSelect={setSelected} audioRef={audio} playingRange={playingRange} />
        </div>
        <div role="radiogroup" aria-label="Sections" className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {sections.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === selected} onClick={() => setSelected(s.id)} className={`focus-ring shrink-0 rounded-xl border px-3 py-2 text-left ${s.id === selected ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`}>
              <span className="flex items-center gap-2 font-display text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[s.type] }} />{s.type} · {clock(s.start_s)}–{clock(s.end_s)}</span>
              <span className="mt-0.5 block font-mono text-[10px] text-muted">{s.traits.join(" · ") || "—"}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="signal" icon={playingRange?.[0] === section.start_s ? "pause" : "play"} onClick={() => void audition(section)}>{playingRange?.[0] === section.start_s ? "Stop" : `Play section ${section.type}`}</Button>
          <Link href={`/studio?song=${song.id}&section=${section.id}`} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 font-body text-[13px] text-ink hover:border-copper/50"><Icon name="amp" size={15} /> Open section {section.type} in the Studio</Link>
          <span className="font-mono text-[10px] text-muted">Measured on {clock(section.excerpt.start_s)}–{clock(section.excerpt.start_s + section.excerpt.duration_s)}</span>
          {/* Owner-only stream of the original upload. */}
          <audio ref={audio} src={songAudioUrl(song.id)} preload="none" className="hidden" />
        </div>
      </section>

      <SectionDetail section={section} main={main} />
      <GearSuggestions recipe={core} measured={{ ...section.raw_features, centroid_hz: section.raw_features.centroid_hz ?? section.character.centroid_hz }} title={`${song.title ?? "Untitled"} · section ${section.type}`} />
      <ToneDashboard key={section.type} songId={song.id} sectionId={section.id} initialRecipe={recipe} measurements={section.raw_features} />
    </div>
  );
}
