"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { Button, buttonClass, IconButton, LinkButton } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import { useServerToggle } from "@/lib/queries/toggle";

const VIS = [["PRIVATE", "Private: only you"], ["UNLISTED", "Unlisted: anyone with the link"], ["PUBLIC", "Public: on your profile and in discovery"]] as const;


// Loaded on first use: the dialog (and its animation runtime) isn't needed until someone reports.
const ReportDialog = dynamic(() => import("@/components/social/ReportDialog"), { ssr: false });
export default function ToneActions({ id, isOwner, saved, visibility, signedIn }: { id: string; isOwner: boolean; saved: boolean; visibility: string; signedIn: boolean }) {
  const router = useRouter();
  const { on: isSaved, toggle: flipSaved } = useServerToggle({ scope: `tone-save:${id}`, initial: saved, send: (next) => api(`/api/tones/${id}/save`, { method: next ? "PUT" : "DELETE" }) });
  const [vis, setVis] = useState(visibility);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const gate = () => {
    if (signedIn) return true;
    router.push(`/login?callbackUrl=/t/${id}`);
    return false;
  };

  const save = () => gate() && flipSaved();
  async function remix() {
    if (!gate()) return;
    setBusy(true);
    try {
      const { tone } = await api<{ tone: { id: string } }>(`/api/tones/${id}/remix`, { method: "POST" });
      router.push(`/t/${tone.id}/edit`);
    } catch (err) {
      setMsg(errorMessage(err));
      setBusy(false);
    }
  }
  async function changeVisibility(v: string) {
    const prev = vis;
    setVis(v);
    try {
      await api(`/api/tones/${id}`, { method: "PATCH", body: { visibility: v } });
      router.refresh();
    } catch (err) {
      setVis(prev);
      setMsg(errorMessage(err));
    }
  }
  async function copyLink() {
    await navigator.clipboard.writeText(`${location.origin}/t/${id}`);
    setMsg("Link copied.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isOwner && <Button variant={isSaved ? "secondary" : "primary"} icon={isSaved ? "bookmark-filled" : "bookmark"} onClick={save}>{isSaved ? "Saved" : "Save tone"}</Button>}
        <Button icon="remix" onClick={remix} disabled={busy}>{isOwner ? "Duplicate" : "Remix"}</Button>
        <LinkButton href={`/compare?a=${id}`} icon="compare">Compare</LinkButton>
        <LinkButton href={`/practice?tone=${id}`} icon="audio">Practice with it</LinkButton>
        <a href={`/api/tones/${id}/export`} className={buttonClass("secondary", "md")}><Icon name="download" size={18} /> Export JSON</a>
        <IconButton icon="link" label="Copy link" onClick={copyLink} />
        {isOwner && <LinkButton href={`/t/${id}/edit`} icon="edit">Edit</LinkButton>}
        {isOwner && <LinkButton href={`/new?tone=${id}`} icon="share" variant="primary">Post it</LinkButton>}
        {!isOwner && signedIn && <IconButton icon="flag" label="Report tone" onClick={() => { setReportLoaded(true); setReporting(true); }} />}
      </div>
      {isOwner && (
        <label className="flex flex-wrap items-center gap-2 font-body text-sm text-muted">
          Visibility
          <select value={vis} onChange={(e) => changeVisibility(e.target.value)} className="panel-inset h-9 rounded-full px-3 text-ink">
            {VIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      )}
      {msg && <p role="status" className="font-body text-sm text-muted">{msg}</p>}
      {reportLoaded && <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="TONE" targetId={id} />}
    </div>
  );
}
