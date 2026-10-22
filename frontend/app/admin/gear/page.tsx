import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import { GEAR_KINDS, GEAR_SELECT } from "@/lib/gear";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import { JsonForm } from "@/components/admin/Forms";
import Table, { StatusPill } from "@/components/admin/Table";

export const metadata = { title: "Gear catalog" };

export default async function GearAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaffPage("catalog.manage");
  const q = (await searchParams).q?.trim();
  const [pending, items] = await Promise.all([
    prisma.gearItem.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { createdBy: { select: { handle: true } } } }),
    prisma.gearItem.findMany({ where: { status: { not: "PENDING" }, ...(q && { OR: [{ brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] }) }, orderBy: [{ kind: "asc" }, { brand: "asc" }], take: 200, select: GEAR_SELECT }),
  ]);
  return (
    <>
      <AdminHeader title="Gear catalog">Member submissions stay pending (usable only by the submitter) until approved.</AdminHeader>
      <h2 className="mb-3 font-display text-xl font-semibold">Pending ({pending.length})</h2>
      <Table head={["Gear", "Kind", "Submitted by", ""]} empty={pending.length ? undefined : "Nothing pending."}>
        {pending.map((g) => <tr key={g.id}><td>{g.brand} {g.model}{g.controls.length > 0 && <span className="block font-mono text-xs text-muted">{g.controls.join(" · ")}</span>}</td><td className="font-mono text-xs">{g.kind}</td><td className="font-mono text-xs">@{g.createdBy?.handle}</td><td className="space-x-2 text-right"><AdminAction url={`/api/admin/gear/${g.id}`} method="PATCH" body={{ status: "APPROVED" }} label="Approve" variant="primary" /><AdminAction url={`/api/admin/gear/${g.id}`} method="PATCH" body={{ status: "REJECTED" }} label="Reject" variant="danger" /></td></tr>)}
      </Table>
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Add to the catalog</h2>
      <JsonForm url="/api/admin/gear" submit="Add gear" fields={[{ name: "kind", label: "Kind", type: "select", options: GEAR_KINDS.map((k) => [k, k]) }, { name: "brand", label: "Brand", required: true }, { name: "model", label: "Model", required: true }, { name: "controls", label: "Controls, comma separated" }]} transform={(v) => ({ ...v, controls: String(v.controls ?? "").split(",").map((s) => s.trim()).filter(Boolean) })} />
      <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Catalog</h2><form action="/admin/gear"><input name="q" defaultValue={q} placeholder="Search" aria-label="Search catalog" className="panel-inset h-9 rounded-full px-3 font-body text-sm" /></form></div>
      <Table head={["Gear", "Kind", "Status", ""]}>
        {items.map((g) => <tr key={g.id}><td>{g.brand} {g.model}</td><td className="font-mono text-xs">{g.kind}</td><td><StatusPill status={g.status} /></td><td className="text-right">{g.status === "APPROVED" ? <AdminAction url={`/api/admin/gear/${g.id}`} method="PATCH" body={{ status: "REJECTED" }} label="Retire" variant="ghost" /> : <AdminAction url={`/api/admin/gear/${g.id}`} method="PATCH" body={{ status: "APPROVED" }} label="Restore" variant="ghost" />}</td></tr>)}
      </Table>
    </>
  );
}
