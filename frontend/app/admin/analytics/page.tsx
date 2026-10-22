import { requireStaffPage } from "@/lib/admin/page";
import { dailySeries, type Metric } from "@/lib/admin/analytics";
import AdminHeader from "@/components/admin/AdminHeader";
import BarChart from "@/components/admin/BarChart";
import Link from "next/link";

export const metadata = { title: "Analytics" };

const CHARTS: { metric: Metric; title: string; unit?: string; color?: string }[] = [
  { metric: "signups", title: "New members" },
  { metric: "active", title: "Active members (posted, commented or voted)", color: "var(--color-signal)" },
  { metric: "posts", title: "Posts" },
  { metric: "comments", title: "Comments" },
  { metric: "tones", title: "Tones saved or created" },
  { metric: "joins", title: "Community joins" },
  { metric: "uploads", title: "Uploads" },
  { metric: "uploadMB", title: "Upload volume", unit: " MB" },
  { metric: "reports", title: "Reports filed", color: "var(--color-amber)" },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaffPage("analytics.view");
  const days = (await searchParams).days === "90" ? 90 : (await searchParams).days === "7" ? 7 : 30;
  const series = await Promise.all(CHARTS.map((c) => dailySeries(c.metric, days)));
  return (
    <>
      <AdminHeader title="Analytics" actions={<div className="flex gap-1">{[7, 30, 90].map((d) => <Link key={d} href={`/admin/analytics?days=${d}`} aria-current={d === days ? "page" : undefined} className={`rounded-full px-3 py-1.5 font-body text-sm ${d === days ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{d} days</Link>)}</div>}>
        Daily totals in UTC, one measure per chart.
      </AdminHeader>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{CHARTS.map((c, i) => <BarChart key={c.metric} title={c.title} data={series[i]} unit={c.unit} color={c.color} />)}</div>
    </>
  );
}
