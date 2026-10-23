import { prisma } from "@/lib/prisma";
import { requestTime } from "@/lib/time";
import { requireStaffPage } from "@/lib/admin/page";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import { JsonForm } from "@/components/admin/Forms";
import Table, { StatusPill } from "@/components/admin/Table";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  await requireStaffPage("platform.config");
  const rows = await prisma.announcement.findMany({ orderBy: { startsAt: "desc" }, take: 50 });
  const now = requestTime();
  return (
    <>
      <AdminHeader title="Announcements">The newest live announcement shows as a banner across the app. Optionally notify every active member (sent in batches by the worker).</AdminHeader>
      <JsonForm
        url="/api/admin/announcements"
        submit="Publish"
        fields={[
          { name: "title", label: "Title", required: true },
          { name: "level", label: "Level", type: "select", options: [["INFO", "Info"], ["WARN", "Warning (maintenance, incidents)"]] },
          { name: "body", label: "Details", type: "textarea" },
          { name: "days", label: "Show for days (blank = until ended)", type: "number" },
          { name: "notify", label: "Also send as a notification", type: "checkbox" },
        ]}
        transform="announcement"
      />
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">History</h2>
      <Table head={["Title", "Level", "Live", "Started", ""]} empty={rows.length ? undefined : "None yet."}>
        {rows.map((a) => {
          const live = a.startsAt.getTime() <= now && (!a.endsAt || a.endsAt.getTime() > now);
          return <tr key={a.id}><td>{a.title}<span className="block text-xs text-muted">{a.body}</span></td><td className="font-mono text-xs">{a.level}</td><td><StatusPill status={live ? "ACTIVE" : "ENDED"} /></td><td className="font-mono text-xs">{a.startsAt.toISOString().slice(0, 16).replace("T", " ")}</td><td className="text-right">{live && <AdminAction url={`/api/admin/announcements/${a.id}`} method="DELETE" label="End now" variant="ghost" />}</td></tr>;
        })}
      </Table>
    </>
  );
}
