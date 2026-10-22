"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

export default function AppealForm({ targetType, targetId }: { targetType: string; targetId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/appeals", { body: { targetType, targetId, body } });
      setBody("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel space-y-3 p-5">
      <label className="block">
        <span className="label-engraved">Why should this be reversed?</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} minLength={20} maxLength={4000} required className="panel-inset mt-2 w-full rounded-xl px-3 py-2 font-body outline-none focus:border-copper/60" />
      </label>
      {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy || body.trim().length < 20}>{busy ? "Sending…" : "Send appeal"}</Button>
    </form>
  );
}
