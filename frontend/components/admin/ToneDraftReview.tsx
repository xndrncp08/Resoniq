"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/ui";
import AdminAction from "@/components/admin/AdminAction";
import { api, errorMessage } from "@/lib/client-api";

export const PUBLISHING_URL = "/api/admin/tone-drafts";
const field = "focus-ring w-full rounded-lg border border-line bg-bg px-3 py-2 text-base";
type Option = { id: string; name: string };

export default function ToneDraftReview({ draft, creators, communities }: {
  draft: { id: string; name: string; description: string; rig: unknown; creatorId: string | null; communityId: string | null; status: string; removed: boolean };
  creators: Option[];
  communities: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("");
  const editable = draft.status !== "PUBLISHED" && !draft.removed;
  async function submit(form: FormData) {
    setBusy(true); setError(null);
    try {
      await api(PUBLISHING_URL, { method: "POST", body: {
        action: "edit", id: draft.id, name: form.get("name"), description: form.get("description"),
        rig: JSON.parse(String(form.get("rig"))), creatorId: form.get("creatorId"), communityId: form.get("communityId") || null,
      } });
      router.refresh();
    } catch (e) { setError(e instanceof SyntaxError ? "Rig JSON is invalid. Fix it before saving." : errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function scheduleDraft() {
    setBusy(true); setError(null);
    try {
      await api(PUBLISHING_URL, { method: "POST", body: { action: "schedule", id: draft.id, scheduledFor: new Date(schedule).toISOString() } });
      router.refresh();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <form action={submit} className="space-y-3">
      <fieldset disabled={!editable || busy} className="space-y-3 disabled:opacity-70">
        <label className="block text-sm">Name<input name="name" required maxLength={120} defaultValue={draft.name} className={field} /></label>
        <label className="block text-sm">Description<textarea name="description" required maxLength={3800} rows={3} defaultValue={draft.description} className={field} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Managed creator<select name="creatorId" required defaultValue={draft.creatorId ?? ""} className={field}><option value="" disabled>Choose a creator</option>{creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm">Community post<select name="communityId" defaultValue={draft.communityId ?? ""} className={field}><option value="">Tone only</option>{communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label className="block text-sm">Rig settings (JSON)<textarea name="rig" required rows={14} defaultValue={JSON.stringify(draft.rig, null, 2)} spellCheck={false} className={`${field} font-mono text-sm`} /></label>
        {editable && <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes and reset approval"}</Button>}
      </fieldset>
    </form>
    {!draft.removed && <div className="flex flex-wrap gap-2">
      {draft.status !== "PUBLISHED" && <><AdminAction url={PUBLISHING_URL} body={{ action: "approve", id: draft.id }} label="Approve" /><AdminAction url={PUBLISHING_URL} body={{ action: "reject", id: draft.id }} label="Reject" variant="ghost" /></>}
      {["APPROVED", "SCHEDULED", "FAILED"].includes(draft.status) && <AdminAction url={PUBLISHING_URL} body={{ action: "publish", id: draft.id }} label="Publish now" variant="primary" confirm="Publish this reviewed tone and its community post now?" />}
      {draft.status === "PUBLISHED" && <AdminAction url={PUBLISHING_URL} body={{ action: "unpublish", id: draft.id }} label="Unpublish" confirm="Hide this tone and remove its community post from public listings?" />}
      {["PUBLISHED", "UNPUBLISHED"].includes(draft.status) && <AdminAction url={PUBLISHING_URL} body={{ action: "remove", id: draft.id }} label="Remove tone" variant="danger" confirm="Delete this managed tone permanently? Its withdrawn discussion and audit history will be retained." />}
    </div>}
    {["APPROVED", "SCHEDULED", "FAILED"].includes(draft.status) && <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">Publish after (your local time)<input type="datetime-local" value={schedule} onChange={e => setSchedule(e.target.value)} className={field} /></label>
      <Button disabled={busy || !schedule} onClick={scheduleDraft}>Schedule</Button>
      <p className="text-xs text-muted">Daily run at 04:17 UTC; two automated publications per UTC day.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
