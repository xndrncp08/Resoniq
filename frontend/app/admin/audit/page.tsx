import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import AdminHeader from "@/components/admin/AdminHeader";
import Table from "@/components/admin/Table";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; target?: string; before?: string }> }) {
  await requireStaffPage("audit.view");
  const sp = await searchParams;
  const actor = sp.actor ? await prisma.user.findFirst({ where: { handle: sp.actor.replace(/^@/, "").toLowerCase() }, select: { id: true } }) : null;
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(sp.action && { action: { startsWith: sp.action } }),
      ...(sp.actor && { actorId: actor?.id ?? "none" }),
      ...(sp.target && { targetId: sp.target }),
      ...(sp.before && { createdAt: { lt: new Date(sp.before) } }),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { handle: true } } },
  });
  const last = rows[rows.length - 1];
  return (
    <>
      <AdminHeader title="Audit log">Every staff action, written in the same transaction as the change itself.</AdminHeader>
      <form action="/admin/audit" className="mb-4 flex flex-wrap gap-2">
        <input name="action" defaultValue={sp.action} placeholder="Action prefix (e.g. user.)" aria-label="Action" className="panel-inset h-10 rounded-full px-4 font-body text-sm" />
        <input name="actor" defaultValue={sp.actor} placeholder="@staff handle" aria-label="Actor" className="panel-inset h-10 rounded-full px-4 font-body text-sm" />
        <input name="target" defaultValue={sp.target} placeholder="Target id" aria-label="Target" className="panel-inset h-10 rounded-full px-4 font-body text-sm" />
        <button className="h-10 rounded-full bg-ink px-4 font-body text-sm text-bg">Filter</button>
      </form>
      <Table head={["When (UTC)", "Who", "Action", "Target", "Reason", "Details"]} empty={rows.length ? undefined : "No entries."}>
        {rows.map((a) => (
          <tr key={a.id}>
            <td className="whitespace-nowrap font-mono text-xs">{a.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
            <td className="font-mono text-xs">{a.actor ? `@${a.actor.handle}` : "cli/system"}</td>
            <td className="font-mono text-xs text-copper">{a.action}</td>
            <td className="font-mono text-xs">{a.targetType}<br /><Link href={`/admin/audit?target=${a.targetId}`} className="text-muted hover:text-ink">{a.targetId}</Link></td>
            <td className="max-w-xs">{a.reason}</td>
            <td className="max-w-xs font-mono text-[11px] text-muted">{a.meta ? JSON.stringify(a.meta) : ""}</td>
          </tr>
        ))}
      </Table>
      {last && rows.length === 100 && <Link href={`/admin/audit?${new URLSearchParams({ ...(sp.action && { action: sp.action }), ...(sp.actor && { actor: sp.actor }), before: last.createdAt.toISOString() })}`} className="mt-4 inline-block font-body text-sm text-copper">Older →</Link>}
    </>
  );
}
