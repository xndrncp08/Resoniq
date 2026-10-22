"use client";

import { useState } from "react";
import Dialog from "@/components/app/Dialog";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

const REASONS = [
  ["SPAM", "Spam or scam"],
  ["HARASSMENT", "Harassment or bullying"],
  ["HATE", "Hate speech"],
  ["NSFW", "Sexual content"],
  ["VIOLENCE", "Violence or threats"],
  ["COPYRIGHT", "Copyright: it's my work"],
  ["IMPERSONATION", "Impersonation"],
  ["MISINFORMATION", "Misleading gear or tone claims"],
  ["OTHER", "Something else"],
] as const;

export type ReportTarget = "POST" | "COMMENT" | "USER" | "MEDIA" | "COMMUNITY" | "TONE";

export default function ReportDialog({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: ReportTarget; targetId: string }) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const needsDetails = reason === "COPYRIGHT" || reason === "OTHER";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api("/api/reports", { body: { targetType, targetId, reason, details } });
      setState("done");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Report">
      {state === "done" ? (
        <div className="space-y-4 font-body text-sm text-ink-dim">
          <p>Thanks. A moderator will review it. Repeat reports from different people put content on hold automatically until someone looks.</p>
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="label-engraved mb-2">What&apos;s wrong?</legend>
            {REASONS.map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 font-body text-sm transition-colors ${reason === value ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`}>
                <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[var(--color-copper)]" />
                {label}
              </label>
            ))}
          </fieldset>
          {reason && (
            <label className="block">
              <span className="label-engraved">{reason === "COPYRIGHT" ? "Your work and where the original is" : needsDetails ? "Details" : "Details (optional)"}</span>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000} required={needsDetails} minLength={needsDetails ? 10 : undefined} className="panel-inset mt-1.5 w-full rounded-xl px-3 py-2 font-body text-sm text-ink outline-none focus:border-copper/60" />
            </label>
          )}
          {reason === "COPYRIGHT" && <p className="font-body text-xs text-muted">See <a className="underline" href="/copyright">how copyright reports work</a>. False claims can lead to account action.</p>}
          {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" disabled={!reason || state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</Button>
        </form>
      )}
    </Dialog>
  );
}
