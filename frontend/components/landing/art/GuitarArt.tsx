/**
 * An offset-body electric, drawn for Resoniq: sunburst lacquer, tortoise
 * guard, two soapbar pickups, bridge, six strings to a reverse-free headstock.
 * Decorative; pass `title` to expose it to assistive tech.
 */
export default function GuitarArt({ className = "", title }: { className?: string; title?: string }) {
  const strings = [0, 1, 2, 3, 4, 5].map((i) => 200 + i * 4.4);
  const frets = Array.from({ length: 21 }, (_, i) => 1086 - 520 * (1 - Math.pow(2, -(i + 1) / 12)) * 1.68);
  return (
    <svg viewBox="80 40 1140 340" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id="ga-burst" cx="0.42" cy="0.5" r="0.62">
          <stop offset="0" stopColor="#FFC08F" />
          <stop offset="0.42" stopColor="#FF8A3D" />
          <stop offset="0.75" stopColor="#7A3A10" />
          <stop offset="1" stopColor="#1A0E07" />
        </radialGradient>
        <linearGradient id="ga-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset=".35" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <pattern id="ga-tort" width="38" height="38" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <rect width="38" height="38" fill="#2A140A" />
          <circle cx="9" cy="11" r="7" fill="#5C2A10" opacity=".7" />
          <circle cx="27" cy="24" r="9" fill="#3E1C0B" opacity=".8" />
          <circle cx="16" cy="32" r="4" fill="#7A3A10" opacity=".5" />
        </pattern>
        <linearGradient id="ga-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B2416" />
          <stop offset="1" stopColor="#1F120A" />
        </linearGradient>
        <linearGradient id="ga-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3EFE8" />
          <stop offset=".5" stopColor="#8B93A1" />
          <stop offset="1" stopColor="#C9C3B8" />
        </linearGradient>
        <filter id="ga-shadow" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="22" stdDeviation="22" floodColor="#000" floodOpacity=".6" /></filter>
      </defs>
      <g filter="url(#ga-shadow)">
        {/* neck and headstock */}
        <rect x="560" y="190" width="530" height="38" rx="6" fill="url(#ga-neck)" />
        <path d="M1086 186 1168 168c18-3 30 9 28 26l-3 34c-1 12-11 18-22 16l-85-12z" fill="url(#ga-neck)" />
        {[1110, 1130, 1150, 1170, 1186, 1196].map((x, i) => <circle key={x} cx={x - (i > 3 ? 4 : 0)} cy={180 - i * 2.2} r="5.5" fill="url(#ga-chrome)" />)}
        {frets.map((x, i) => <rect key={i} x={x} y="190" width="2" height="38" fill="#C9C3B8" opacity=".75" />)}
        {[3, 5, 7, 9, 15, 17].map((n) => <circle key={n} cx={(frets[n - 1] + frets[n - 2]) / 2} cy="209" r="3.4" fill="#F3EFE8" opacity=".85" />)}
        <circle cx={(frets[10] + frets[11]) / 2} cy="200" r="3.4" fill="#F3EFE8" opacity=".85" />
        <circle cx={(frets[10] + frets[11]) / 2} cy="218" r="3.4" fill="#F3EFE8" opacity=".85" />
        <rect x="1084" y="189" width="5" height="40" fill="#F3EFE8" />
        {/* body */}
        <path d="M126 214c-4-92 62-150 148-146 64 3 86 40 138 42 40 1 58-18 92-16 64 4 94 56 94 112s-26 110-94 116c-34 3-52-18-92-16-52 2-76 42-140 46-90 6-142-50-146-138z" fill="url(#ga-burst)" />
        <path d="M126 214c-4-92 62-150 148-146 64 3 86 40 138 42 40 1 58-18 92-16 64 4 94 56 94 112" fill="url(#ga-gloss)" />
        {/* pickguard */}
        <path d="M206 150c40-28 96-26 136-2 40 24 120 28 170 20l40 26c-10 46-10 80 0 126-60 16-120 4-176 18-58 14-118 6-160-34-30-30-40-110-10-154z" fill="url(#ga-tort)" stroke="#F3EFE8" strokeOpacity=".5" strokeWidth="2" />
        {/* pickups */}
        {[330, 432].map((x) => (
          <g key={x}>
            <rect x={x - 17} y="176" width="34" height="70" rx="9" fill="#0E1218" stroke="#343D4C" strokeWidth="2" />
            {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={x} cy={186 + i * 10} r="3" fill="#8B93A1" />)}
          </g>
        ))}
        {/* bridge and tailpiece */}
        <rect x="222" y="182" width="30" height="58" rx="4" fill="url(#ga-chrome)" />
        {strings.map((y) => <rect key={y} x="226" y={y - 1.2} width="22" height="2.4" rx="1" fill="#6C7584" />)}
        {/* controls */}
        {[[474, 294], [516, 280], [486, 120]].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="14" fill="#0E1218" stroke="url(#ga-chrome)" strokeWidth="3" />
            <path d={`M${cx} ${cy}l-6-9`} stroke="#F3EFE8" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ))}
        <rect x="538" y="114" width="20" height="10" rx="5" fill="url(#ga-chrome)" />
        {/* strings */}
        {strings.map((y, i) => <path key={i} d={`M236 ${y}L1086 ${197 + i * 4.6}L${1110 + i * 17} ${178 - i * 2}`} fill="none" stroke="#E9E2D6" strokeWidth={1.6 - i * 0.12} opacity=".9" />)}
      </g>
    </svg>
  );
}
