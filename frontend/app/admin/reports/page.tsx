import Link from "next/link";
import type { ReportTarget } from "@prisma/client";
import { requireStaffPage } from "@/lib/admin/page";
import { reportQueue } from "@/lib/admin/queue";
import { REPORT_TARGETS } from "@/lib/reports";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import { StatusPill } from "@/components/admin/Table";
import { Chip } from "@/components/app/ui";

export const metadata = { title: "Report queue" };

/** The moderation endpoint (and its permission) for each kind of target. */
function actionFor(type: ReportTarget, id: string) {
  if (type === "POST") return <AdminAction url={`/api/posts/${id}/moderation`} body={{ action: "remove" }} label="Remove post" variant="danger" reason={{ field: "reason", placeholder: "Reason shown to the author" }} />;
  if (type === "COMMENT") return <AdminAction url={`/api/comments/${id}/moderation`} body={{ action: "remove" }} label="Remove comment" variant="danger" reason={{ field: "reason", placeholder: "Reason shown to the author" }} />;
  if (type === "MEDIA") return <AdminAction url={`/api/media/${id}/moderation`} body={{ action: "remove" }} label="Take down media" variant="danger" reason={{ field: "reason", placeholder: "e.g. Copyright: unlicensed studio recording" }} />;
  if (type === "TONE") return <AdminAction url={`/api/admin/tones/${id}`} body={{ action: "unpublish" }} label="Unpublish tone" variant="danger" reason={{ field: "reason", placeholder: "Reason shown to the creator" }} />;
  if (type === "MESSAGE") return <AdminAction url={`/api/admin/messages/${id}`} body={{ action: "remove" }} label="Remove message" variant="danger" reason={{ field: "reason", placeholder: "Reason shown to the sender" }} />;
  if (type === "USER") return <Link href={`/admin/users/${id}`} className="font-body text-sm text-copper hover:underline">Open member →</Link>;
  return <Link href="/admin/communities" className="font-body text-sm text-copper hover:underline">Manage communities →</Link>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireStaffPage("content.moderate");
  const want = (await searchParams).type;
  const type = REPORT_TARGETS.find((t) => t === want);
  const items = await reportQueue(type);
  return (
    <>
      <AdminHeader title="Report queue">Grouped by what was reported. Copyright first, then the most-reported. Removing content closes its reports; dismissing lifts holds that reports alone caused.</AdminHeader>
      <div className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...REPORT_TARGETS].map((t) => <Link key={t ?? "all"} href={t ? `/admin/reports?type=${t}` : "/admin/reports"} className={`rounded-full px-3 py-1.5 font-body text-sm ${type === t ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{t ? t.toLowerCase() : "all"}</Link>)}
      </div>
      {items.length === 0 ? (
        <p className="panel p-8 text-center font-body text-muted">The queue is clear.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={`${i.targetType}:${i.targetId}`} className={`panel p-4 ${i.reasons.COPYRIGHT ? "border-amber/40" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Chip>{i.targetType.toLowerCase()}</Chip>
                    {i.preview.status && <StatusPill status={i.preview.status} />}
                    <span className="font-mono text-xs text-muted">{i.reports} report{i.reports > 1 ? "s" : ""} · since {i.firstAt.toISOString().slice(0, 10)}</span>
                  </div>
                  <p className="line-clamp-2 font-body text-[15px]">{i.preview.href ? <Link href={i.preview.href} className="hover:underline" target="_blank">{i.preview.title}</Link> : i.preview.title}</p>
                  {i.preview.author && <p className="font-mono text-xs text-muted">by @{i.preview.author}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(i.reasons).map(([r, n]) => <span key={r} className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${r === "COPYRIGHT" ? "border-amber/40 text-amber" : "border-line text-ink-dim"}`}>{r.toLowerCase()} ×{n}</span>)}</div>
                  {i.details.length > 0 && <ul className="mt-2 space-y-1 border-l-2 border-line pl-3 font-body text-sm text-ink-dim">{i.details.map((d, k) => <li key={k}>“{d}”</li>)}</ul>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {actionFor(i.targetType, i.targetId)}
                  <AdminAction url="/api/admin/reports" body={{ action: "dismiss", targetType: i.targetType, targetId: i.targetId }} label="Dismiss" variant="ghost" reason={{ field: "note", placeholder: "Why no action" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
