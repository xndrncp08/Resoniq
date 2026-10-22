import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import Table, { StatusPill } from "@/components/admin/Table";

export const metadata = { title: "Communities" };

export default async function CommunitiesAdminPage() {
  await requireStaffPage("communities.manage");
  const rows = await prisma.community.findMany({ orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }], take: 300, include: { createdBy: { select: { handle: true } }, _count: { select: { members: { where: { role: "MODERATOR" } } } } } });
  return (
    <>
      <AdminHeader title="Communities">Newest first, so member-created communities are easy to review. Archiving makes a community read-only and hides it from the directory.</AdminHeader>
      <Table head={["Community", "Created by", "Members", "Posts", "Mods", "Status", ""]}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td><Link href={`/c/${c.slug}`} target="_blank" className="hover:underline">{c.name}</Link><span className="block font-mono text-xs text-muted">c/{c.slug} · {c.kind.toLowerCase()} · {c.createdAt.toISOString().slice(0, 10)}</span></td>
            <td className="font-mono text-xs">{c.createdBy ? `@${c.createdBy.handle}` : "staff seed"}</td>
            <td className="font-mono">{c.memberCount}</td>
            <td className="font-mono">{c.postCount}</td>
            <td className="font-mono">{c._count.members}</td>
            <td><StatusPill status={c.archivedAt ? "REMOVED" : "ACTIVE"} /></td>
            <td className="space-y-1 text-right">
              {c.archivedAt ? <AdminAction url={`/api/admin/communities/${c.id}`} body={{ action: "unarchive" }} label="Unarchive" /> : <AdminAction url={`/api/admin/communities/${c.id}`} body={{ action: "archive" }} label="Archive" variant="danger" reason={{ field: "reason", placeholder: "Reason for the log" }} />}
              <AdminAction url={`/api/admin/communities/${c.id}`} body={{ action: "moderator", role: "MODERATOR" }} label="Add moderator" reason={{ field: "handle", placeholder: "@handle" }} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
