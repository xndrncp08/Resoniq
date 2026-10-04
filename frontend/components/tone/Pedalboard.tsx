"use client";

import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
import type { PedalSlot } from "@/types/tone";
import Knob from "@/components/ui/tactile/Knob";
import { spring } from "@/lib/motion";

const KNOBS = ["drive", "tone", "level"] as const;
type KnobKey = (typeof KNOBS)[number];

function PedalBody({
  pedal,
  onChange,
  handle,
}: {
  pedal: PedalSlot;
  onChange?: (pedal: PedalSlot) => void;
  handle?: React.ReactNode;
}) {
  const knobs = KNOBS.filter((k) => pedal[k] !== undefined);

  return (
    <div
      className={`flex h-full w-[168px] flex-col rounded-2xl border p-4 transition-colors duration-200 ${
        pedal.enabled ? "border-copper/40 bg-copper/[0.05]" : "border-white/[0.06] bg-white/[0.015]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {String(pedal.slot).padStart(2, "0")} · {pedal.type}
          </div>
          <div className="mt-1 font-display text-sm font-medium leading-tight">{pedal.name}</div>
        </div>
        {handle}
      </div>

      <div className="mt-4 flex flex-1 flex-wrap justify-center gap-x-3 gap-y-2">
        {knobs.map((k: KnobKey) => (
          <Knob
            key={k}
            label={k}
            size={44}
            // Drive is a real pot; tone and level are trims.
            weight={k === "drive" ? "medium" : "light"}
            value={pedal[k] ?? 0}
            disabled={!pedal.enabled}
            onChange={onChange && ((v) => onChange({ ...pedal, [k]: v }))}
          />
        ))}
      </div>

      {/* Footswitch: bypass toggle with a status LED */}
      <button
        type="button"
        role="switch"
        aria-checked={pedal.enabled}
        aria-label={`${pedal.name} ${pedal.enabled ? "on" : "bypassed"}`}
        disabled={!onChange}
        onClick={() => onChange?.({ ...pedal, enabled: !pedal.enabled })}
        className="focus-ring mt-4 flex items-center justify-center gap-2 rounded-full border border-white/10 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition enabled:hover:border-white/20 disabled:cursor-default"
      >
        <span
          className={`h-2 w-2 rounded-full transition ${
            pedal.enabled ? "bg-copper shadow-[0_0_8px_var(--color-copper)]" : "bg-white/15"
          }`}
        />
        {pedal.enabled ? "on" : "bypass"}
      </button>
    </div>
  );
}

function DraggablePedal({
  pedal,
  onChange,
  onDragEnd,
}: {
  pedal: PedalSlot;
  onChange: (pedal: PedalSlot) => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={pedal}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="relative flex-shrink-0"
      transition={spring.layout}
      whileDrag={{ scale: 1.03, zIndex: 10, boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6)" }}
    >
      <PedalBody
        pedal={pedal}
        onChange={onChange}
        handle={
          <button
            type="button"
            aria-label={`Drag to reorder ${pedal.name}`}
            onPointerDown={(e) => controls.start(e)}
            className="focus-ring -mr-2 -mt-1 cursor-grab touch-none rounded p-1.5 text-muted hover:text-ink active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        }
      />
    </Reorder.Item>
  );
}

/**
 * The pedal chain between guitar and amp. Drag the grip to reorder; slots
 * are renumbered to match the new order. Without onChange it is read-only.
 */
export default function Pedalboard({
  pedals,
  onChange,
}: {
  pedals: PedalSlot[];
  onChange?: (pedals: PedalSlot[]) => void;
}) {
  if (pedals.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center font-body text-sm text-muted">
        No pedals detected. This tone comes straight from the amp.
      </p>
    );
  }

  if (!onChange) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {pedals.map((p) => (
          <div key={p.slot} className="flex-shrink-0">
            <PedalBody pedal={p} />
          </div>
        ))}
      </div>
    );
  }

  // Reorder tracks items by object identity, so slots are only renumbered
  // once the drag ends; mid-drag the objects (and their slot keys) stay put.
  const renumber = () => {
    if (pedals.some((p, i) => p.slot !== i + 1)) {
      onChange(pedals.map((p, i) => ({ ...p, slot: i + 1 })));
    }
  };

  return (
    <Reorder.Group axis="x" values={pedals} onReorder={onChange} className="flex gap-3 overflow-x-auto pb-2">
      {pedals.map((p) => (
        <DraggablePedal
          key={p.slot}
          pedal={p}
          onChange={(updated) => onChange(pedals.map((q) => (q === p ? updated : q)))}
          onDragEnd={renumber}
        />
      ))}
    </Reorder.Group>
  );
}
