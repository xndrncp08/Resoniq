"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/icons/Icon";

const modelUrl = "https://sketchfab.com/3d-models/3d-guitar-black-strat-9cfa538c43404968bed2b0c023393357";

/** The creator permits the official viewer, not downloads. No third-party work starts before a click. */
export default function GuitarShowcase() {
  const [active, setActive] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!active) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setActive(false);
    });
    if (stage.current) observer.observe(stage.current);
    const onVisibility = () => { if (document.hidden) setActive(false); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  return (
    <div ref={stage} className="relative isolate overflow-hidden rounded-[24px] border border-line bg-bg-0 shadow-panel">
      <div className="relative aspect-[4/3] sm:aspect-[16/10]">
        <Image src="/images/studio-guitar-1920.webp" alt="Black electric guitar, tube amplifier and copper and teal pedals in a warmly lit studio" fill sizes="(max-width: 1024px) 100vw, 62vw" preload className="object-cover object-[65%_center]" />
        {active ? (
          <iframe
            title="Explore 3D Guitar — Black Strat by Viva_1"
            src="https://sketchfab.com/models/9cfa538c43404968bed2b0c023393357/embed?autostart=1&autospin=0&animation_autoplay=0&preload=0&max_texture_size=1024&dnt=1&transparent=1&ui_theme=dark&ui_ar=0&ui_vr=0"
            loading="lazy"
            allow="fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/90 via-transparent to-transparent p-5 sm:p-8">
            <div>
              <p className="label-engraved mb-3 text-signal">The instrument, in every dimension</p>
              <button ref={trigger} onClick={() => setActive(true)} className="focus-ring inline-flex min-h-12 items-center gap-3 rounded-full bg-ink px-6 font-body text-sm font-semibold text-bg hover:bg-copper-soft">
                <Icon name="play" size={18} /> Explore the Black Strat in 3D
              </button>
              <p className="mt-3 max-w-sm font-body text-xs text-ink-dim">Interactive model by Viva_1. Loads from Sketchfab when you open it. Studio photograph shown above.</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 font-mono text-[11px] text-muted">
        <a href={modelUrl} target="_blank" rel="noopener noreferrer" className="rounded hover:text-ink">3D Guitar — Black Strat · Viva_1 ↗</a>
        {active ? <button onClick={() => { setActive(false); requestAnimationFrame(() => trigger.current?.focus()); }} className="rounded px-2 py-1 text-copper hover:text-ink">Close 3D viewer</button> : <span>No automatic movement</span>}
      </div>
    </div>
  );
}
