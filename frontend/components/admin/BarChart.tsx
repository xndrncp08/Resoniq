"use client";

import { useState } from "react";

type Point = { day: string; value: number };

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * One measure per chart (small multiples, never two axes): daily bars in a
 * single hue, a recessive grid, a hover readout, and a table for screen readers.
 */
export default function BarChart({ title, data, unit = "", color = "var(--color-copper)" }: { title: string; data: Point[]; unit?: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const total = data.reduce((s, d) => s + d.value, 0);
  const W = 600, H = 150, gap = 2, bw = (W - gap * (data.length - 1)) / data.length;
  const shown = hover !== null ? data[hover] : null;

  return (
    <figure className="panel p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-body text-sm font-medium">{title}</span>
        <span className="font-mono text-xs text-muted" aria-live="polite">
          {shown ? <><span className="text-ink">{shown.value.toLocaleString()}{unit}</span> · {fmtDay(shown.day)}</> : <>{total.toLocaleString()}{unit} in {data.length} days</>}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`${title}: ${total} over ${data.length} days`} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--color-line)" strokeDasharray="2 4" />
            <text x={W} y={H - H * f - 4} textAnchor="end" fontSize="10" fill="var(--color-muted)" fontFamily="var(--font-mono)">{(top * f).toLocaleString()}</text>
          </g>
        ))}
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--color-line-strong)" />
        {data.map((d, i) => {
          const h = (d.value / top) * H;
          const x = i * (bw + gap);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              {/* Hit target taller than the bar. */}
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              {d.value > 0 && <path d={`M${x},${H} V${H - h + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)} H${x + bw - Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)} V${H} Z`} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />}
            </g>
          );
        })}
        <text x={0} y={H + 14} fontSize="10" fill="var(--color-muted)" fontFamily="var(--font-mono)">{fmtDay(data[0]?.day ?? "")}</text>
        <text x={W} y={H + 14} fontSize="10" fill="var(--color-muted)" fontFamily="var(--font-mono)" textAnchor="end">{fmtDay(data[data.length - 1]?.day ?? "")}</text>
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Day</th><th>Value</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
