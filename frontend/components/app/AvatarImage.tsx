"use client";

import { useState, type ReactNode } from "react";

/** An avatar photo that falls back to initials if it can't load (an expired Google URL, a removed upload). */
export default function AvatarImage({ src, size, className, fallback }: { src: string; size: number; className: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatars are our media route, static defaults, or Google photos
    <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} className={className} style={{ width: size, height: size }} />
  );
}
