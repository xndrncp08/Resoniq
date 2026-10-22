import type { ReactNode } from "react";

/** Dense data table for the console: sticky header, hairline rows, horizontal scroll on small screens. */
export default function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[640px] text-left font-body text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr>{head.map((h) => <th key={h} scope="col" className="label-engraved border-b hairline px-4 py-2.5 font-normal">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-6 text-center font-body text-sm text-muted">{empty}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    ACTIVE: "text-success border-success/30", PUBLISHED: "text-success border-success/30", READY: "text-success border-success/30", APPROVED: "text-success border-success/30", SUCCEEDED: "text-success border-success/30", PUBLIC: "text-success border-success/30",
    SUSPENDED: "text-amber border-amber/30", HELD: "text-amber border-amber/30", PROCESSING: "text-amber border-amber/30", PENDING: "text-amber border-amber/30", QUEUED: "text-amber border-amber/30", RUNNING: "text-amber border-amber/30", OPEN: "text-amber border-amber/30",
    BANNED: "text-danger border-danger/30", REMOVED: "text-danger border-danger/30", FAILED: "text-danger border-danger/30", REJECTED: "text-danger border-danger/30",
  };
  return <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${tone[status] ?? "border-line text-muted"}`}>{status.toLowerCase()}</span>;
}
