import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import Icon, { type IconName } from "@/components/icons/Icon";
import AvatarImage from "@/components/app/AvatarImage";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "signal";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-copper text-bg hover:bg-copper-soft shadow-[0_8px_24px_-12px_rgba(255,138,61,0.8)]",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:border-copper/50 hover:bg-surface-3",
  ghost: "text-muted hover:bg-white/[0.05] hover:text-ink",
  danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
  signal: "bg-signal text-bg hover:brightness-110",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2.5 px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `focus-ring tap-clean inline-flex shrink-0 select-none items-center justify-center rounded-full font-body font-medium transition-[background,color,border,filter,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant,
  size,
  icon,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; icon?: IconName }) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  icon,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: IconName }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </Link>
  );
}

/** Icon-only button: always labelled for screen readers. */
export function IconButton({
  icon,
  label,
  active = false,
  size = 40,
  className = "",
  ...props
}: Omit<ComponentProps<"button">, "children"> & { icon: IconName; label: string; active?: boolean; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`focus-ring tap-clean inline-flex shrink-0 items-center justify-center rounded-full transition-colors ${active ? "text-copper" : "text-muted hover:bg-white/[0.06] hover:text-ink"} ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </button>
  );
}

export function Avatar({ user, size = 40, className = "" }: { user: { name: string | null; handle: string; image: string | null }; size?: number; className?: string }) {
  const initials = (user.name ?? user.handle).replace(/^u_/, "").slice(0, 2).toUpperCase();
  // A stable hue per handle so avatars without photos still tell people apart.
  const hue = [...user.handle].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const initialsBadge = (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-ink ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(140deg, hsl(${hue} 45% 32%), hsl(${(hue + 40) % 360} 40% 18%))` }}
    >
      {initials}
    </span>
  );
  return user.image ? (
    <AvatarImage src={user.image} size={size} className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`} fallback={initialsBadge} />
  ) : (
    initialsBadge
  );
}

export function Chip({ children, active = false, icon, className = "" }: { children: ReactNode; active?: boolean; icon?: IconName; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] ${active ? "border-copper/60 bg-copper/10 text-copper" : "border-line bg-surface-2 text-ink-dim"} ${className}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

/**
 * The provenance label that runs through the whole product: what the creator
 * declared about their rig versus what Resoniq's analysis inferred.
 */
export function Provenance({ kind, edited = false, className = "" }: { kind: "declared" | "inferred" | "generated"; edited?: boolean; className?: string }) {
  if (kind === "generated") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-amber ${className}`} title="Suggested starting settings written by Resoniq. Not taken from a recording, and not tested on the listed gear.">
        <Icon name="knob" size={13} /> Resoniq-generated
      </span>
    );
  }
  return kind === "declared" ? (
    <span className={`inline-flex items-center gap-1 rounded-full border border-copper/40 bg-copper/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-copper ${className}`} title="Gear the creator says they used">
      <Icon name="declared" size={13} /> Creator declared
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-signal ${className}`} title="Estimated from the audio by Resoniq's analysis: a heuristic closest match, not a verified rig">
      <Icon name="inferred" size={13} /> {edited ? "Inferred · adjusted" : "Resoniq inferred"}
    </span>
  );
}

export function ManagedCreatorBadge() {
  return <span className="rounded-full border border-signal/40 px-2 py-0.5 font-mono text-[10px] text-signal" title="An editorial demo identity owned and operated by Resoniq, not an independent musician.">Resoniq-managed</span>;
}

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel grille flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="panel-inset flex h-14 w-14 items-center justify-center rounded-2xl text-copper">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {children && <div className="max-w-md font-body text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} style={{ width: size, height: size }} />;
}

export type TabItem = { href: string; label: string; active: boolean; count?: number };

/** Route-driven tabs (each tab is a link), so state lives in the URL. */
export function Tabs({ items, label, className = "" }: { items: TabItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={`scrollbar-none flex gap-1 overflow-x-auto ${className}`}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          scroll={false}
          className={`focus-ring relative whitespace-nowrap rounded-full px-4 py-2 font-body text-sm transition-colors ${t.active ? "bg-ink text-bg" : "text-muted hover:bg-white/[0.05] hover:text-ink"}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 font-mono text-xs opacity-70">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-engraved mb-2">{eyebrow}</p>}
        <h1 className="font-display text-display-md font-semibold tracking-tight">{title}</h1>
        {children && <div className="mt-2 max-w-2xl font-body text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "3h", "2d": compact relative time with the full timestamp on hover. */
export function shortAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  for (const [unit, size] of UNITS) if (s >= size) return `${Math.floor(s / size)}${unit === "month" ? "mo" : unit[0]}`;
  return "now";
}

export function TimeAgo({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className} suppressHydrationWarning>
      {shortAgo(iso)}
    </time>
  );
}

export const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
