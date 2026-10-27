"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import Icon from "@/components/icons/Icon";
import { buttonClass } from "@/components/app/ui";
import { deviceStorage } from "@/lib/consent";

export type PlannerTone = { id: string; name: string; amp: string | null };
type Slots = (string | null)[];

const SLOTS = 36;
const label = (i: number) => `${Math.floor(i / 4) + 1}${"ABCD"[i % 4]}`;
const fill = (ids: string[]): Slots => Array.from({ length: SLOTS }, (_, i) => ids[i] ?? null);

// localStorage as an external store: no hydration mismatch, and other tabs stay in sync.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}
const notify = () => listeners.forEach((cb) => cb());
function readStored(key: string) {
  return deviceStorage.getItem(key);
}

/**
 * Assign presets to the pedal's 36 slots. Choosing a preset that sits in another slot swaps the two.
 * shortcut: the plan lives in this browser's localStorage (no server column for it); move it to the
 * database if members ask for plans that follow them across devices.
 */
export default function BankPlanner({ userId, tones, defaultOrder }: { userId: string; tones: PlannerTone[]; defaultOrder: string[] }) {
  const key = `resoniq:tank-g-banks:v2:${userId}`;
  const byId = useMemo(() => new Map(tones.map((t) => [t.id, t])), [tones]);
  const stored = useSyncExternalStore(subscribe, () => readStored(key), () => null);
  // Holds edits when storage is unavailable (private mode), so the planner still works for this visit.
  const [local, setLocal] = useState<Slots | null>(null);

  // A saved plan drops presets that were unsaved since; only presets saved after it was made fill its empty slots.
  const restored = useMemo((): Slots | null => {
    try {
      const saved = JSON.parse(stored ?? "null") as { slots?: unknown; seen?: unknown } | null;
      if (!saved || !Array.isArray(saved.slots) || saved.slots.length !== SLOTS || !Array.isArray(saved.seen)) return null;
      const seen = new Set(saved.seen);
      const kept: Slots = saved.slots.map((id) => (typeof id === "string" && byId.has(id) ? id : null));
      const fresh = defaultOrder.filter((id) => !seen.has(id));
      return kept.map((id) => id ?? fresh.shift() ?? null);
    } catch { return null; }
  }, [stored, byId, defaultOrder]);
  const slots = local ?? restored ?? fill(defaultOrder);

  function update(next: Slots) {
    setLocal(next);
    deviceStorage.setItem(key, JSON.stringify({ slots: next, seen: tones.map((t) => t.id) }));
    setLocal(null);
    notify();
  }
  function assign(slot: number, id: string | null) {
    const next = [...slots];
    const from = id ? next.indexOf(id) : -1;
    if (from >= 0) next[from] = next[slot];
    next[slot] = id;
    update(next);
  }
  function reset() {
    setLocal(null);
    deviceStorage.removeItem(key);
    notify();
  }

  const placed = new Set(slots.filter(Boolean));
  const unplaced = tones.filter((t) => !placed.has(t.id));
  const download = `/api/tones/tank-g-banks?order=${slots.map((s) => s ?? "").join(",")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <a href={download} download className={buttonClass("primary", "md")}><Icon name="download" size={18} /> Download setup sheets (.txt)</a>
        <button type="button" onClick={reset} className={buttonClass("ghost", "md")}>Reset to default order</button>
        <p className="font-body text-sm text-muted" aria-live="polite">{placed.size} of {SLOTS} slots filled{restored || local ? " · your plan" : " · default order"}</p>
      </div>
      <ol aria-label="Banks" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: SLOTS / 4 }, (_, b) => (
          <li key={b} className="panel min-w-0 p-4">
            <p className="label-engraved mb-3">Bank {b + 1}</p>
            <ol className="space-y-2">
              {[0, 1, 2, 3].map((i) => {
                const slot = b * 4 + i;
                const t = slots[slot] ? byId.get(slots[slot]!) : undefined;
                return (
                  <li key={i} className="flex min-w-0 items-center gap-3">
                    <span className="panel-inset flex h-10 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-xs text-copper" aria-hidden>{label(slot)}</span>
                    <div className="min-w-0 flex-1">
                      <select
                        aria-label={`Slot ${label(slot)}`}
                        value={t?.id ?? ""}
                        onChange={(e) => assign(slot, e.target.value || null)}
                        className="panel-inset h-10 w-full rounded-lg px-2 font-body text-base text-ink outline-none focus:border-copper/60 sm:text-sm"
                      >
                        <option value="">Empty</option>
                        {tones.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      {t && (
                        <span className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted">
                          <span className="truncate">{t.amp ?? "Member rig"}</span>
                          <Link href={`/t/${t.id}#tank-g-h`} className="shrink-0 text-copper hover:underline">Settings</Link>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {unplaced.length > 0 && (
        <section className="panel-inset rounded-2xl p-4">
          <p className="label-engraved mb-2">Not placed ({unplaced.length})</p>
          <p className="font-body text-sm text-muted">The pedal stores 36 presets. Pick any of these in a slot to swap it in: {unplaced.map((t, i) => <span key={t.id}>{i > 0 && ", "}<Link href={`/t/${t.id}`} className="text-copper hover:underline">{t.name}</Link></span>)}.</p>
        </section>
      )}
    </div>
  );
}
