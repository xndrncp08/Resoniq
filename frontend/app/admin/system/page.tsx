import { requireStaffPage } from "@/lib/admin/page";
import { requestTime } from "@/lib/time";
import { systemHealth } from "@/lib/admin/analytics";
import { isEnabled } from "@/lib/flags";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import Stat from "@/components/admin/Stat";
import Table, { StatusPill } from "@/components/admin/Table";

export const metadata = { title: "System & jobs" };
export const dynamic = "force-dynamic";

const ago = (d: Date | null, now: number) => (d ? `${Math.round((now - d.getTime()) / 1000)}s ago` : "never");

export default async function SystemPage() {
  await requireStaffPage("system.view");
  const h = await systemHealth();
  const uploads = await isEnabled("uploads.enabled");
  const now = requestTime();
  const lag = h.jobs.oldestDueAt ? Math.round((now - h.jobs.oldestDueAt.getTime()) / 1000) : 0;
  return (
    <>
      <AdminHeader title="System & jobs">Health checks run when this page loads. The worker processes media and background jobs from the Postgres queue.</AdminHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Database" value={h.db.ok ? "OK" : "DOWN"} sub={`${h.db.ms} ms round trip`} icon="server" alert={!h.db.ok} />
        <Stat label="Analysis engine" value={!h.engine.configured ? "Not set" : h.engine.ok ? "OK" : "DOWN"} sub={h.engine.configured ? `${h.engine.ms} ms` : "PYTHON_ENGINE_URL unset"} icon="analyze" alert={h.engine.configured && !h.engine.ok} />
        <Stat label="Queue lag" value={`${lag}s`} sub={`last job finished ${ago(h.jobs.lastFinishedAt, now)}`} icon="jobs" alert={lag > 120} />
        <Stat label="Storage" value={h.storage} sub={uploads ? "uploads enabled" : "uploads paused (flag)"} icon="vault" alert={!uploads} />
      </div>
      {lag > 120 && <p className="panel mb-6 border-amber/40 p-4 font-body text-sm text-amber">Jobs have been due for over two minutes. Check that the worker service is running (<span className="font-mono">docker compose logs worker</span>).</p>}
      <h2 className="mb-3 font-display text-xl font-semibold">Jobs by type</h2>
      <Table head={["Type", "Status", "Count"]}>
        {h.jobs.byType.map((r) => <tr key={`${r.type}${r.status}`}><td className="font-mono">{r.type}</td><td><StatusPill status={r.status} /></td><td className="font-mono">{r._count}</td></tr>)}
      </Table>
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Running</h2>
      <Table head={["Job", "Type", "Worker", "Started", "Attempt"]} empty={h.jobs.running.length ? undefined : "Nothing running."}>
        {h.jobs.running.map((j) => <tr key={j.id}><td className="font-mono text-xs">{j.id}</td><td className="font-mono">{j.type}</td><td className="font-mono text-xs">{j.lockedBy}</td><td>{ago(j.lockedAt, now)}</td><td>{j.attempts}/{j.maxAttempts}</td></tr>)}
      </Table>
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Failed</h2>
      <Table head={["Job", "Type", "Payload", "Error", ""]} empty={h.jobs.failed.length ? undefined : "No failed jobs."}>
        {h.jobs.failed.map((j) => (
          <tr key={j.id}>
            <td className="font-mono text-xs">{j.id}<br /><span className="text-muted">{j.finishedAt?.toISOString().slice(0, 16).replace("T", " ")}</span></td>
            <td className="font-mono">{j.type}</td>
            <td className="max-w-[220px] truncate font-mono text-xs">{JSON.stringify(j.payload)}</td>
            <td className="max-w-[360px]"><pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-danger">{j.lastError}</pre></td>
            <td><AdminAction url={`/api/admin/jobs/${j.id}`} label="Retry" /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
