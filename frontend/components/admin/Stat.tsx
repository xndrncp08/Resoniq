import Link from "next/link";
import Icon, { type IconName } from "@/components/icons/Icon";

/** A KPI tile: one number, one label, optional context. Status-colored only when something needs attention. */
export default function Stat({ label, value, sub, icon, href, alert = false }: { label: string; value: string | number; sub?: string; icon: IconName; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className="flex items-center justify-between">
        <span className="label-engraved">{label}</span>
        <Icon name={icon} size={18} className={alert ? "text-amber" : "text-muted"} />
      </span>
      <span className="mt-3 block font-display text-4xl font-semibold tabular-nums tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</span>
      {sub && <span className={`mt-1 flex items-center gap-1.5 font-mono text-xs ${alert ? "text-amber" : "text-muted"}`}>{alert && <Icon name="alert" size={13} />}{sub}</span>}
    </>
  );
  const cls = `panel block p-4 ${alert ? "border-amber/40" : ""} ${href ? "transition-colors hover:border-copper/40 focus-ring" : ""}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
