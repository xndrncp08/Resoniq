import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import { can } from "@/lib/permissions";
import AdminNav, { type AdminNavItem } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: { default: "Control center", template: "%s · Control center" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaffPage();
  const [reports, appeals, held, pendingGear, failedJobs] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.appeal.count({ where: { status: "OPEN" } }),
    prisma.post.count({ where: { status: "HELD" } }),
    prisma.gearItem.count({ where: { status: "PENDING" } }),
    prisma.job.count({ where: { status: "FAILED" } }),
  ]);
  const c = (p: Parameters<typeof can>[1]) => can(actor.role, p);
  const sections: [string, AdminNavItem[]][] = [
    ["Operations", [
      { href: "/admin", label: "Overview", icon: "gauge" },
      ...(c("analytics.view") ? [{ href: "/admin/analytics", label: "Analytics", icon: "chart" as const }] : []),
      ...(c("system.view") ? [{ href: "/admin/system", label: "System & jobs", icon: "server" as const, badge: failedJobs }] : []),
    ]],
    ["Trust & safety", [
      { href: "/admin/reports", label: "Report queue", icon: "flag", badge: reports },
      { href: "/admin/held", label: "Held content", icon: "shield", badge: held },
      { href: "/admin/appeals", label: "Appeals", icon: "gavel", badge: appeals },
      { href: "/admin/users", label: "Members", icon: "users" },
      { href: "/admin/media", label: "Media", icon: "video" },
      ...(c("platform.config") ? [{ href: "/admin/rules", label: "Automod rules", icon: "rules" as const }] : []),
    ]],
    ["Platform", [
      ...(c("communities.manage") ? [{ href: "/admin/communities", label: "Communities", icon: "community" as const }] : []),
      ...(c("catalog.manage") ? [{ href: "/admin/gear", label: "Gear catalog", icon: "gear-catalog" as const, badge: pendingGear }] : []),
      ...(c("curation.manage") ? [{ href: "/admin/curation", label: "Curation", icon: "spotlight" as const }] : []),
      ...(c("platform.config") ? [{ href: "/admin/announcements", label: "Announcements", icon: "megaphone" as const }, { href: "/admin/flags", label: "Feature flags", icon: "toggle" as const }] : []),
      ...(c("audit.view") ? [{ href: "/admin/audit", label: "Audit log", icon: "audit" as const }] : []),
    ]],
  ];
  return (
    <div className="min-h-dvh bg-bg-0 lg:flex">
      <aside className="border-b hairline bg-bg px-3 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-5 flex items-center justify-between px-3">
          <Link href="/admin" className="focus-ring flex items-center gap-2 rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.svg" alt="" width={28} height={28} />
            <span>
              <span className="block font-display text-[15px] font-semibold leading-tight">Control center</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-amber">{actor.role.toLowerCase()} · @{actor.handle}</span>
            </span>
          </Link>
          <Link href="/feed" className="font-body text-xs text-muted hover:text-ink">Exit</Link>
        </div>
        <details className="lg:hidden"><summary className="cursor-pointer px-3 font-body text-sm text-muted">Sections</summary><div className="mt-3"><AdminNav sections={sections} /></div></details>
        <div className="hidden lg:block"><AdminNav sections={sections} /></div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
