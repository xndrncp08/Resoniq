import Link from "next/link";
import type { AccountStatus, Role } from "@prisma/client";
import { requireStaffPage } from "@/lib/admin/page";
import { listUsers, ROLES, STATUSES } from "@/lib/admin/users";
import AdminHeader from "@/components/admin/AdminHeader";
import Table, { StatusPill } from "@/components/admin/Table";
import { Avatar } from "@/components/app/ui";

export const metadata = { title: "Members" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; role?: string; page?: string }> }) {
  await requireStaffPage("users.suspend");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) as AccountStatus | undefined;
  const role = ROLES.find((r) => r === sp.role) as Role | undefined;
  const page = Math.max(0, Number(sp.page) || 0);
  const { rows, total } = await listUsers({ search: sp.q?.trim().slice(0, 100), status, role, page });
  const qs = (o: Record<string, string | number | undefined>) => `/admin/users?${new URLSearchParams(Object.entries({ q: sp.q, status, role, page, ...o }).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "").map(([k, v]) => [k, String(v)]))}`;
  return (
    <>
      <AdminHeader title="Members">{total.toLocaleString()} matching accounts. Email is visible here to staff only.</AdminHeader>
      <form action="/admin/users" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Handle, name, email or id" className="panel-inset h-10 w-72 rounded-full px-4 font-body text-sm outline-none" aria-label="Search members" />
        <select name="status" defaultValue={status ?? ""} className="panel-inset h-10 rounded-full px-3 font-body text-sm" aria-label="Status"><option value="">Any status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="role" defaultValue={role ?? ""} className="panel-inset h-10 rounded-full px-3 font-body text-sm" aria-label="Role"><option value="">Any role</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        <button className="h-10 rounded-full bg-ink px-4 font-body text-sm text-bg">Filter</button>
      </form>
      <Table head={["Member", "Email", "Role", "Status", "Posts", "Reports filed", "Joined"]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td><Link href={`/admin/users/${u.id}`} className="flex items-center gap-2 hover:underline"><Avatar user={u} size={28} /> <span>{u.name ?? u.handle}<span className="block font-mono text-xs text-muted">@{u.handle}</span></span></Link></td>
            <td className="font-mono text-xs">{u.email}</td>
            <td><StatusPill status={u.role} /></td>
            <td><StatusPill status={u.status} />{u.suspendedUntil && <span className="block font-mono text-[10px] text-muted">until {u.suspendedUntil.toISOString().slice(0, 10)}</span>}</td>
            <td className="font-mono">{u._count.posts}</td>
            <td className="font-mono">{u._count.reports}</td>
            <td className="font-mono text-xs">{u.createdAt.toISOString().slice(0, 10)}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 flex justify-between font-body text-sm">
        {page > 0 ? <Link href={qs({ page: page - 1 })} className="text-copper">← Newer</Link> : <span />}
        {(page + 1) * 50 < total && <Link href={qs({ page: page + 1 })} className="text-copper">Older →</Link>}
      </div>
    </>
  );
}
