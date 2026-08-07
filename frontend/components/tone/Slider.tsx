"use client";

export default function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="focus-ring h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-copper"
      />
    </label>
  );
}