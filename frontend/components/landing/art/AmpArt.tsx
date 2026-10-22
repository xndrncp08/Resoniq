/** A boutique amp head: tolex, grille cloth, brass faceplate with chicken-head knobs and a jewel light. */
export default function AmpArt({ className = "", settings = [6.5, 4, 6, 7, 5, 6] }: { className?: string; settings?: number[] }) {
  const labels = ["GAIN", "BASS", "MID", "TREBLE", "PRES", "MASTER"];
  return (
    <svg viewBox="0 0 820 330" className={className} aria-hidden>
      <defs>
        <linearGradient id="aa-tolex" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#232A36" /><stop offset="1" stopColor="#0E1218" /></linearGradient>
        <pattern id="aa-grille" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#2B1F17" /><path d="M0 10L10 0M-2 2L2-2M8 12l4-4" stroke="#8A6A44" strokeWidth="1.4" opacity=".55" /></pattern>
        <linearGradient id="aa-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E8C48A" /><stop offset=".5" stopColor="#B8925A" /><stop offset="1" stopColor="#7A5A2E" /></linearGradient>
        <radialGradient id="aa-knob" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#F3EFE8" /><stop offset=".45" stopColor="#C9C3B8" /><stop offset="1" stopColor="#3B3A36" /></radialGradient>
        <radialGradient id="aa-jewel" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#FFE0C2" /><stop offset=".4" stopColor="#FF8A3D" /><stop offset="1" stopColor="#7A2A00" /></radialGradient>
        <filter id="aa-glow"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="aa-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="18" floodOpacity=".6" /></filter>
      </defs>
      <g filter="url(#aa-shadow)">
        <rect x="10" y="10" width="800" height="300" rx="22" fill="url(#aa-tolex)" stroke="#343D4C" strokeWidth="2" />
        <path d="M330 10v-0" />
        <rect x="300" y="-4" width="220" height="22" rx="11" fill="#0E1218" stroke="#343D4C" strokeWidth="2" />
        <rect x="36" y="34" width="748" height="132" rx="10" fill="url(#aa-grille)" stroke="#0A0D12" strokeWidth="4" />
        <g transform="translate(330 84)" opacity=".9">
          <g fill="none" stroke="#E8C48A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M0 32V0h10a8 8 0 0 1 0 16H0M10 16l9 16" /><path d="M48 0H29v32h19M29 16h14" />
            <path d="M77 6c-2-4-6-6-10-6-6 0-10 3-10 8 0 10 20 6 20 16 0 5-4 8-10 8-5 0-9-2-11-6" /><circle cx="101" cy="16" r="16" />
            <path d="M128 32V0l21 32V0" /><path d="M160 0v32" /><circle cx="186" cy="16" r="16" />
          </g>
          <path d="M186 16l17 11" stroke="#FF8A3D" strokeWidth="5" strokeLinecap="round" />
        </g>
        <rect x="36" y="186" width="748" height="102" rx="10" fill="url(#aa-brass)" />
        <rect x="36" y="186" width="748" height="102" rx="10" fill="none" stroke="#5A4220" strokeWidth="2" />
        {labels.map((l, i) => {
          const cx = 104 + i * 96;
          const a = -135 + (settings[i] / 10) * 270;
          return (
            <g key={l}>
              <text x={cx} y="206" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono), monospace" fill="#3B2A12" letterSpacing="1.5">{l}</text>
              {Array.from({ length: 11 }, (_, t) => {
                const ta = ((-135 + t * 27 - 90) * Math.PI) / 180;
                return <circle key={t} cx={Math.round((cx + Math.cos(ta) * 33) * 100) / 100} cy={Math.round((246 + Math.sin(ta) * 33) * 100) / 100} r="1.6" fill="#3B2A12" />;
              })}
              <circle cx={cx} cy="246" r="24" fill="url(#aa-knob)" stroke="#2A2620" strokeWidth="2" />
              <path d={`M${cx} 246v-20`} stroke="#0A0D12" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a} ${cx} 246)`} />
            </g>
          );
        })}
        <circle cx="708" cy="246" r="26" fill="#FF8A3D" opacity=".55" filter="url(#aa-glow)" />
        <circle cx="708" cy="246" r="15" fill="url(#aa-jewel)" stroke="#3B2A12" strokeWidth="3" />
        <rect x="748" y="226" width="12" height="40" rx="6" fill="#0E1218" />
        <rect x="747" y="226" width="14" height="18" rx="7" fill="url(#aa-knob)" />
      </g>
    </svg>
  );
}
