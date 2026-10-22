"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

/** Inline moderation for staff on a post page. Every action is re-checked and audited on the server. */
export default function ModerationBar({ kind, id, status }: { kind: "post" | "comment"; id: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const removed = status === "REMOVED" || status === "HELD";
  async function act(action: "remove" | "restore") {
    setError(null);
    try {
      await api(`/api/${kind}s/${id}/moderation`, { body: { action, reason } });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <div className="panel flex flex-wrap items-center gap-3 border-amber/30 p-3">
      <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber"><Icon name="shield" size={16} /> Moderation · {status.toLowerCase()}</span>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the author)" className="panel-inset h-9 min-w-[200px] flex-1 rounded-full px-3 font-body text-sm outline-none" />
      {removed && <Button size="sm" onClick={() => act("restore")}>Approve / restore</Button>}
      {status !== "REMOVED" && <Button size="sm" variant="danger" onClick={() => act("remove")} disabled={!reason.trim()}>Remove</Button>}
      {error && <p className="w-full font-body text-sm text-danger">{error}</p>}
    </div>
  );
}
