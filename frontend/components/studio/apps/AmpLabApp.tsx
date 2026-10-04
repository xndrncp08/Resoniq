"use client";

import { memo, useState } from "react";
import AmpPanel from "@/components/tone/AmpPanel";
import type { AmpSettings, PickupPosition } from "@/types/tone";
import type { AppComponentProps } from "@/components/studio/apps";

const FLAT: AmpSettings = { family: "Sandbox", model: "Flat amp", gain: 30, bass: 50, mids: 50, treble: 50, presence: 50 };

/** A scratch amp for trying EQ moves and watching the curve, independent of any song. */
function AmpLabApp(_: AppComponentProps) {
  const [amp, setAmp] = useState(FLAT);
  const [pickup, setPickup] = useState<PickupPosition>("Bridge");
  return (
    <div className="space-y-3 p-4">
      <AmpPanel amp={amp} cabinet={{ type: "2x12 open-back", speaker: "any" }} pickup={pickup} onAmpChange={setAmp} onPickupChange={setPickup} />
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs text-muted">Knobs at noon are flat. The curve is the response the signal monitor plays.</p>
        <button
          type="button"
          onClick={() => setAmp(FLAT)}
          className="focus-ring flex-shrink-0 rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-ink"
        >
          flatten
        </button>
      </div>
    </div>
  );
}

export default memo(AmpLabApp);
