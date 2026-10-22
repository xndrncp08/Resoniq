"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const ExampleTones = dynamic(() => import("./ExampleTones"), { loading: () => <p role="status" className="p-8 font-body text-sm text-muted">Loading the example analysis…</p> });

/** Keep the full amp/EQ controls off the initial marketing-page download. */
export default function DeferredExample() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="panel flex flex-wrap items-center justify-between gap-6 p-7 sm:p-10">
        <div className="max-w-xl">
          <p className="label-engraved text-signal">Inside an analysis</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">From recording to a rig you can try.</h2>
          <p className="mt-4 font-body text-sm leading-relaxed text-ink-dim">See a real metal riff analyzed into amp settings, a pedalboard and EQ. The example includes the source recording, measured values and the engine’s misses.</p>
        </div>
        <button aria-expanded={open} aria-controls="landing-example" onClick={() => setOpen(!open)} className="rounded-full border border-line-strong px-6 py-3 font-body text-sm text-copper hover:border-copper">{open ? "Close example analysis" : "Explore an example analysis"}</button>
      </div>
      <div id="landing-example">{open && <ExampleTones />}</div>
    </div>
  );
}
