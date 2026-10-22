import Link from "next/link";
import type { MediaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import Table, { StatusPill } from "@/components/admin/Table";

export const metadata = { title: "Media" };
const STATUSES: MediaStatus[] = ["READY", "PROCESSING", "FAILED", "REMOVED", "UPLOADING"];
const size = (b: number) => (b > 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default async function MediaAdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage("content.moderate");
  const want = (await searchParams).status;
  const status = STATUSES.find((s) => s === want);
  const rows = await prisma.media.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100, include: { owner: { select: { handle: true } } } });
  return (
    <>
      <AdminHeader title="Media">Uploads across the platform. Takedowns block access immediately; files are purged 30 days later unless restored.</AdminHeader>
      <div className="mb-4 flex flex-wrap gap-1">{[undefined, ...STATUSES].map((s) => <Link key={s ?? "all"} href={s ? `/admin/media?status=${s}` : "/admin/media"} className={`rounded-full px-3 py-1.5 font-body text-sm ${status === s ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{s ? s.toLowerCase() : "all"}</Link>)}</div>
      <Table head={["Preview", "Kind", "Owner", "Status", "Size", "Uploaded", ""]} empty={rows.length ? undefined : "Nothing here."}>
        {rows.map((m) => (
          <tr key={m.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <td>{m.posterKey || (m.kind === "IMAGE" && m.playbackKey) ? <img src={`/api/media/${m.id}/${m.kind === "IMAGE" ? "playback" : "poster"}`} alt="" className="h-12 w-20 rounded object-cover" /> : <span className="font-mono text-xs text-muted">—</span>}</td>
            <td className="font-mono text-xs">{m.kind.toLowerCase()}{m.durationSec ? ` · ${Math.round(m.durationSec)}s` : ""}</td>
            <td className="font-mono text-xs">@{m.owner.handle}{m.postId && <Link href={`/p/${m.postId}`} target="_blank" className="block text-copper">post ↗</Link>}</td>
            <td><StatusPill status={m.status} />{m.error && <span className="block max-w-[220px] text-xs text-danger">{m.error}</span>}{m.removedReason && <span className="block max-w-[220px] text-xs text-muted">{m.removedReason}</span>}</td>
            <td className="font-mono text-xs">{size(m.sizeBytes)}</td>
            <td className="font-mono text-xs">{m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            <td className="text-right">
              {m.status === "READY" && <AdminAction url={`/api/media/${m.id}/moderation`} body={{ action: "remove" }} label="Take down" variant="danger" reason={{ field: "reason", placeholder: "Reason shown to the uploader" }} />}
              {m.status === "REMOVED" && m.playbackKey && <AdminAction url={`/api/media/${m.id}/moderation`} body={{ action: "restore", reason: "restored" }} label="Restore" />}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
