"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

/**
 * A console action: calls an admin API and refreshes. With `reason`, it first
 * asks for one inline (the server requires reasons for anything user-facing).
 */
export default function AdminAction({
  url,
  method = "POST",
  body = {},
  label,
  variant = "secondary",
  reason,
  confirm,
  extra,
}: {
  url: string;
  method?: string;
  body?: Record<string, unknown>;
  label: string;
  variant?: "secondary" | "danger" | "primary" | "ghost";
  reason?: { field: string; placeholder: string };
  confirm?: string;
  extra?: { field: string; label: string; type: "number"; placeholder?: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      await api(url, { method, body: { ...body, ...(reason && { [reason.field]: text }), ...(extra && extraValue && { [extra.field]: Number(extraValue) }) } });
      setOpen(false);
      setText("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (reason && open) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={reason.placeholder} autoFocus className="panel-inset h-8 w-56 rounded-full px-3 font-body text-sm outline-none" aria-label={reason.placeholder} />
        {extra && <input value={extraValue} onChange={(e) => setExtraValue(e.target.value)} type="number" placeholder={extra.placeholder} aria-label={extra.label} className="panel-inset h-8 w-28 rounded-full px-3 font-body text-sm outline-none" />}
        <Button size="sm" variant={variant} disabled={busy || !text.trim()} onClick={run}>{busy ? "…" : label}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        {error && <span className="font-body text-xs text-danger">{error}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant={variant} disabled={busy} onClick={() => (reason ? setOpen(true) : run())}>{busy ? "…" : label}</Button>
      {error && <span className="font-body text-xs text-danger">{error}</span>}
    </span>
  );
}
