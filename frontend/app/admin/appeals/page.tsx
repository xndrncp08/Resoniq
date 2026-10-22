import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/admin/Table";
import { Chip } from "@/components/app/ui";

export const metadata = { title: "Appeals" };

const href = (type: string, id: string) => (type === "POST" ? `/p/${id}` : type === "ACCOUNT" ? `/admin/users/${id}` : null);

export default async function AppealsAdminPage() {
  await requireStaffPage("content.moderate");
  const [open, recent] = await Promise.all([
    prisma.appeal.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 100, include: { user: { select: { handle: true } } } }),
    prisma.appeal.findMany({ where: { status: { not: "OPEN" } }, orderBy: { decidedAt: "desc" }, take: 20, include: { user: { select: { handle: true } }, decidedBy: { select: { handle: true } } } }),
  ]);
  const originals = await prisma.auditLog.findMany({ where: { targetId: { in: open.map((a) => a.targetId) }, action: { in: ["post.remove", "comment.remove", "media.remove", "user.suspended"] } }, orderBy: { createdAt: "desc" }, include: { actor: { select: { handle: true } } } });
  return (
    <>
      <AdminHeader title="Appeals">Reversing restores the content or lifts the suspension. You can&apos;t decide an appeal of your own action.</AdminHeader>
      {open.length === 0 && <p className="panel p-8 text-center font-body text-muted">No open appeals.</p>}
      <ul className="space-y-3">
        {open.map((a) => {
          const orig = originals.find((o) => o.targetId === a.targetId);
          const link = href(a.targetType, a.targetId);
          return (
            <li key={a.id} className="panel p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2"><Chip>{a.targetType.toLowerCase()}</Chip><span className="font-mono text-xs text-muted">@{a.user.handle} · {a.createdAt.toISOString().slice(0, 10)}</span>{link && <Link href={link} target="_blank" className="font-body text-sm text-copper hover:underline">View</Link>}</div>
              {orig && <p className="mb-2 font-body text-sm text-muted">Original action by @{orig.actor?.handle ?? "system"}: {orig.reason}</p>}
              <p className="whitespace-pre-wrap font-body text-[15px] text-ink-dim">{a.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminAction url={`/api/admin/appeals/${a.id}`} body={{ decision: "REVERSED" }} label="Reverse" variant="primary" reason={{ field: "note", placeholder: "Note to the member" }} />
                <AdminAction url={`/api/admin/appeals/${a.id}`} body={{ decision: "UPHELD" }} label="Uphold" reason={{ field: "note", placeholder: "Why the decision stands" }} />
              </div>
            </li>
          );
        })}
      </ul>
      {recent.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-display text-xl font-semibold">Recently decided</h2>
          <ul className="panel divide-y divide-line">{recent.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 font-body text-sm"><StatusPill status={a.status} /><span>@{a.user.handle} · {a.targetType.toLowerCase()}</span><span className="text-muted">by @{a.decidedBy?.handle}: {a.decisionNote}</span></li>)}</ul>
        </>
      )}
    </>
  );
}
