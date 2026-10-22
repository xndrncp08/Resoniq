import { requireStaffPage } from "@/lib/admin/page";
import { dailySeries, overview } from "@/lib/admin/analytics";
import AdminHeader from "@/components/admin/AdminHeader";
import BarChart from "@/components/admin/BarChart";
import Stat from "@/components/admin/Stat";

export const metadata = { title: "Overview" };

const gb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);

export default async function AdminOverview() {
  await requireStaffPage();
  const [o, signups, posts, active] = await Promise.all([overview(), dailySeries("signups", 30), dailySeries("posts", 30), dailySeries("active", 30)]);
  return (
    <>
      <AdminHeader title="Overview">Live counts from the database. Nothing here is sampled or estimated.</AdminHeader>
      <section aria-label="Needs attention" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open reports" value={o.openReports} icon="flag" href="/admin/reports" alert={o.openReports > 0} sub={o.openReports ? "waiting for review" : "queue clear"} />
        <Stat label="Held content" value={o.held} icon="shield" href="/admin/held" alert={o.held > 0} sub="automod and report holds" />
        <Stat label="Open appeals" value={o.openAppeals} icon="gavel" href="/admin/appeals" alert={o.openAppeals > 0} />
        <Stat label="Failed jobs" value={o.failedJobs} icon="jobs" href="/admin/system" alert={o.failedJobs > 0} sub={`${o.processing} uploads processing`} />
      </section>
      <section aria-label="Platform" className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Members" value={o.users} icon="users" sub={`+${o.newUsers} this week · ${o.suspended} suspended · ${o.banned} banned`} href="/admin/users" />
        <Stat label="Published posts" value={o.posts} icon="feed" />
        <Stat label="Tones" value={o.tones} icon="tone" sub={`${o.publicTones} public`} />
        <Stat label="Media stored" value={gb(o.mediaBytes)} icon="video" sub={`${o.communities} active communities`} />
      </section>
      <section aria-label="Last 30 days" className="grid gap-4 xl:grid-cols-3">
        <BarChart title="New members per day" data={signups} />
        <BarChart title="Posts per day" data={posts} />
        <BarChart title="Active members per day" data={active} color="var(--color-signal)" />
      </section>
    </>
  );
}
