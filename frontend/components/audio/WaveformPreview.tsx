"use client";

import { useEffect, useRef } from "react";

export default function WaveformPreview({ file }: { file: File }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<import("wavesurfer.js").default | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      if (cancelled || !containerRef.current) return;

      objectUrl = URL.createObjectURL(file);

      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#8B93A1",
        progressColor: "#FF8A3D",
        cursorColor: "#37E6C9",
        height: 64,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
      });

      wavesurferRef.current.load(objectUrl);
    })();

    return () => {
      cancelled = true;
      wavesurferRef.current?.destroy();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return <div ref={containerRef} className="w-full" />;
}
