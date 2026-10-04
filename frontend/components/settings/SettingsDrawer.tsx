"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { Settings2, X } from "lucide-react";
import { spring } from "@/lib/motion";
import { updateSettings, useSettings, type QualityPref, type ScenePref } from "@/lib/settings/store";
import { useDialogFocus } from "@/lib/use-dialog-focus";

/** Gear button plus the drawer it opens. Drop it anywhere in a header. */
export default function SettingsDrawer({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        aria-label="Display settings"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-ink ${className}`}
      >
        <Settings2 size={16} />
      </button>
      <AnimatePresence>{open && <Drawer onClose={close} />}</AnimatePresence>
    </>
  );
}

/**
 * Slides in from the right on a spring. Drag it right to dismiss: a flick or
 * pulling past a third of its width closes it; anything less springs back.
 */
function Drawer({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const settings = useSettings();
  useDialogFocus(panel, onClose);

  return (
    <motion.div
      className="fixed inset-0 z-[9500] bg-black/50 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="absolute inset-y-0 right-0 flex w-[min(380px,100vw)] flex-col border-l border-white/10 bg-bg-elevated/90 shadow-2xl backdrop-blur-xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={spring.snappy}
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.04, right: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 120 || info.velocity.x > 600) onClose();
        }}
      >
        <header
          onPointerDown={(e) => dragControls.start(e)}
          className="flex cursor-grab touch-none items-center justify-between border-b border-white/[0.06] px-5 py-4 active:cursor-grabbing"
        >
          <div>
            <div aria-hidden className="mb-2 h-1 w-8 rounded-full bg-white/15" />
            <h2 id="settings-title" className="font-display text-lg font-medium">
              Display
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close settings"
            className="focus-ring rounded-full p-2 text-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className="custom-scrollbar flex-1 space-y-7 overflow-y-auto px-5 py-6">
          <Choice<ScenePref>
            label="Background scene"
            hint="The 3D field behind every page. Auto turns it off for reduced motion, Save-Data and low-memory devices."
            value={settings.scene}
            options={[
              ["auto", "Auto"],
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(scene) => updateSettings({ scene })}
          />
          <Choice<QualityPref>
            label="Scene quality"
            hint="High keeps bloom and full resolution. Auto steps down by itself if the frame rate drops."
            value={settings.quality}
            options={[
              ["auto", "Auto"],
              ["high", "High"],
              ["low", "Low"],
            ]}
            onChange={(quality) => updateSettings({ quality })}
          />
          <Choice<"on" | "off">
            label="Haptics"
            hint="A short vibration at knob end-stops and switch detents, on devices that support it."
            value={settings.haptics ? "on" : "off"}
            options={[
              ["on", "On"],
              ["off", "Off"],
            ]}
            onChange={(v) => updateSettings({ haptics: v === "on" })}
          />
          <p className="font-body text-xs leading-relaxed text-muted">
            Animations follow your system&apos;s reduced-motion setting. These preferences are saved in this browser only.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  const name = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <fieldset>
      <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{label}</legend>
      <div role="radiogroup" aria-label={label} className="mt-2 grid grid-flow-col gap-1 rounded-full border border-white/10 p-1">
        {options.map(([v, text]) => {
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(v)}
              className={`focus-ring relative rounded-full px-3 py-1.5 font-body text-sm transition-colors ${active ? "text-bg" : "text-muted hover:text-ink"}`}
            >
              {active && (
                <motion.span layoutId={`${name}-active`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-copper" />
              )}
              <span className="relative">{text}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-body text-xs text-muted">{hint}</p>
    </fieldset>
  );
}
