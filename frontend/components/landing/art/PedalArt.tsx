/** A stomp box in Resoniq livery: three pots, a status LED, a footswitch and jacks. */
export default function PedalArt({ className = "", color = "#FF8A3D", name = "DRIVE", on = true }: { className?: string; color?: string; name?: string; on?: boolean }) {
  return (
    <svg viewBox="0 0 220 330" className={className} aria-hidden>
      <defs>
        <linearGradient id={`pa-body-${name}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor="#1B212B" /></linearGradient>
        <radialGradient id="pa-pot" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#3A4350" /><stop offset="1" stopColor="#0A0D12" /></radialGradient>
        <radialGradient id="pa-sw" cx=".4" cy=".35" r=".8"><stop offset="0" stopColor="#F3EFE8" /><stop offset="1" stopColor="#6C7584" /></radialGradient>
        <filter id="pa-glow"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <rect x="8" y="8" width="204" height="314" rx="22" fill={`url(#pa-body-${name})`} stroke="#0A0D12" strokeWidth="3" />
      <rect x="8" y="8" width="204" height="314" rx="22" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="2" />
      <rect x="-4" y="70" width="14" height="26" rx="3" fill="#8B93A1" />
      <rect x="210" y="70" width="14" height="26" rx="3" fill="#8B93A1" />
      {[[58, 64, -40], [162, 64, 60], [110, 118, 10]].map(([cx, cy, a], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="24" fill="url(#pa-pot)" stroke="#000" strokeOpacity=".4" strokeWidth="2" />
          <path d={`M${cx} ${cy}v-17`} stroke="#F3EFE8" strokeWidth="3.4" strokeLinecap="round" transform={`rotate(${a} ${cx} ${cy})`} />
        </g>
      ))}
      {on && <circle cx="110" cy="174" r="12" fill="#FF3D2E" opacity=".9" filter="url(#pa-glow)" />}
      <circle cx="110" cy="174" r="5.5" fill={on ? "#FFB09E" : "#3A1410"} />
      <text x="110" y="220" textAnchor="middle" fontSize="22" fontWeight="700" fontFamily="var(--font-display), sans-serif" fill="#0A0D12" letterSpacing="3">{name}</text>
      <circle cx="110" cy="272" r="26" fill="#0E1218" />
      <circle cx="110" cy="272" r="18" fill="url(#pa-sw)" />
    </svg>
  );
}
