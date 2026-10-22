import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import { KINDS, PLACEMENTS } from "@/lib/admin/curation";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import { JsonForm } from "@/components/admin/Forms";
import Table from "@/components/admin/Table";

export const metadata = { title: "Curation" };

export default async function CurationPage() {
  await requireStaffPage("curation.manage");
  const slots = await prisma.featuredSlot.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] });
  return (
    <>
      <AdminHeader title="Curation">Feature public posts, tones, musicians or communities on the landing page, the home feed or Explore. Featured items disappear automatically if they stop being public.</AdminHeader>
      <JsonForm
        url="/api/admin/featured"
        submit="Feature it"
        fields={[
          { name: "placement", label: "Where", type: "select", options: PLACEMENTS.map((p) => [p, p.toLowerCase()]) },
          { name: "kind", label: "What", type: "select", options: KINDS.map((k) => [k, k.toLowerCase()]) },
          { name: "target", label: "Link, @handle, c/slug or id", required: true },
          { name: "position", label: "Order (lower first)", type: "number", defaultValue: "0" },
          { name: "days", label: "Run for days (blank = until removed)", type: "number" },
          { name: "note", label: "Internal note" },
        ]}
      />
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Live and scheduled</h2>
      <Table head={["Where", "What", "Target", "Order", "Ends", ""]} empty={slots.length ? undefined : "Nothing featured."}>
        {slots.map((s) => <tr key={s.id}><td className="font-mono text-xs">{s.placement}</td><td className="font-mono text-xs">{s.kind}</td><td className="font-mono text-xs">{s.targetId}{s.note && <span className="block font-body text-muted">{s.note}</span>}</td><td className="font-mono">{s.position}</td><td className="font-mono text-xs">{s.endsAt?.toISOString().slice(0, 10) ?? "—"}</td><td className="text-right"><AdminAction url={`/api/admin/featured/${s.id}`} method="DELETE" label="Remove" variant="ghost" /></td></tr>)}
      </Table>
    </>
  );
}
