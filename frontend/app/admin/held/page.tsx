import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import Table from "@/components/admin/Table";

export const metadata = { title: "Held content" };

export default async function HeldPage() {
  await requireStaffPage("content.moderate");
  const [posts, comments] = await Promise.all([
    prisma.post.findMany({ where: { status: "HELD" }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true, title: true, body: true, heldReasons: true, createdAt: true, author: { select: { handle: true } } } }),
    prisma.comment.findMany({ where: { status: "HELD" }, orderBy: { createdAt: "asc" }, take: 100, select: { id: true, body: true, postId: true, createdAt: true, author: { select: { handle: true } } } }),
  ]);
  return (
    <>
      <AdminHeader title="Held content">Automod and report-threshold holds. Only the author and staff can see these until someone approves or removes them.</AdminHeader>
      <h2 className="mb-3 font-display text-xl font-semibold">Posts</h2>
      <Table head={["Post", "Author", "Why", "Held since", ""]} empty={posts.length ? undefined : "No held posts."}>
        {posts.map((p) => (
          <tr key={p.id}>
            <td className="max-w-md"><Link href={`/p/${p.id}`} target="_blank" className="line-clamp-2 hover:underline">{p.title ?? p.body.slice(0, 160)}</Link></td>
            <td className="font-mono text-xs">@{p.author.handle}</td>
            <td className="font-mono text-xs text-amber">{p.heldReasons.join(", ") || "—"}</td>
            <td className="font-mono text-xs">{p.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td className="space-y-1 text-right">
              <AdminAction url={`/api/posts/${p.id}/moderation`} body={{ action: "restore", reason: "" }} label="Approve" variant="primary" />
              <AdminAction url={`/api/posts/${p.id}/moderation`} body={{ action: "remove" }} label="Remove" variant="danger" reason={{ field: "reason", placeholder: "Reason shown to the author" }} />
            </td>
          </tr>
        ))}
      </Table>
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Comments</h2>
      <Table head={["Comment", "Author", "Held since", ""]} empty={comments.length ? undefined : "No held comments."}>
        {comments.map((c) => (
          <tr key={c.id}>
            <td className="max-w-md"><Link href={`/p/${c.postId}#comments`} target="_blank" className="line-clamp-2 hover:underline">{c.body}</Link></td>
            <td className="font-mono text-xs">@{c.author.handle}</td>
            <td className="font-mono text-xs">{c.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td className="space-y-1 text-right">
              <AdminAction url={`/api/comments/${c.id}/moderation`} body={{ action: "restore", reason: "" }} label="Approve" variant="primary" />
              <AdminAction url={`/api/comments/${c.id}/moderation`} body={{ action: "remove" }} label="Remove" variant="danger" reason={{ field: "reason", placeholder: "Reason" }} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
