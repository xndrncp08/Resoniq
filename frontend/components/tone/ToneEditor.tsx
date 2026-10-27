"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Provenance } from "@/components/app/ui";
import RigEditor, { emptyRig, rigIsEmpty } from "@/components/tone/rig/RigEditor";
import { api, errorMessage } from "@/lib/client-api";
import { SaveStatus, useUnsavedChanges } from "@/components/app/UnsavedChanges";
import type { RigSpec } from "@/types/rig";

export default function ToneEditor({ tone }: { tone: { id: string | null; name: string; description: string | null; visibility: string; rig: RigSpec | null; hasInferred: boolean; generated?: boolean } }) {
  const router = useRouter();
  const [name, setName] = useState(tone.name);
  const [description, setDescription] = useState(tone.description ?? "");
  const [visibility, setVisibility] = useState(tone.visibility);
  const [rig, setRig] = useState<RigSpec>(tone.rig ?? emptyRig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshot = (n: string, d: string, v: string, r: RigSpec) => JSON.stringify([n.trim(), d.trim(), v, rigIsEmpty(r) ? null : r]);
  const [saved, setSaved] = useState(() => snapshot(tone.name, tone.description ?? "", tone.visibility, tone.rig ?? emptyRig()));
  const dirty = snapshot(name, description, visibility, rig) !== saved;

  /** Saves and returns the tone id; throws on failure so nothing is marked saved. */
  async function persist() {
    setBusy(true);
    setError(null);
    const body = { name, description: description || null, visibility, rig: rigIsEmpty(rig) ? null : rig };
    try {
      const id = tone.id
        ? (await api<{ tone: { id: string } }>(`/api/tones/${tone.id}`, { method: "PATCH", body })).tone.id
        : (await api<{ tone: { id: string } }>("/api/tones", { body })).tone.id;
      setSaved(snapshot(name, description, visibility, rig));
      return id;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }
  const { confirmLeave } = useUnsavedChanges({ dirty, label: "this tone", save: name.trim() ? persist : undefined });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const id = await persist().catch(() => null);
    if (!id) return;
    router.push(`/t/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="panel space-y-4 p-5">
        <label className="block"><span className="label-engraved">Name</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-display text-lg outline-none" /></label>
        <label className="block"><span className="label-engraved">About this tone</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} placeholder="Songs it's for, how to play it, what to tweak" className="panel-inset mt-2 w-full rounded-xl px-3 py-2 font-body outline-none" /></label>
        <label className="block">
          <span className="label-engraved">Visibility</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body">
            <option value="PRIVATE">Private: only you</option>
            <option value="UNLISTED">Unlisted: anyone with the link</option>
            <option value="PUBLIC">Public: on your profile and in discovery</option>
          </select>
        </label>
      </div>
      <div className="panel space-y-3 p-5">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">{tone.generated ? "Suggested rig remix" : "Your rig"}</h2><Provenance kind={tone.generated ? "generated" : "declared"} /></div>
        <p className="font-body text-sm text-muted">{tone.generated ? "This starts from generated settings. Your edits preserve that provenance and credit the original tone." : <>Everything is optional. Share as much or as little of your setup as you like{tone.hasInferred ? "; Resoniq's inferred recipe stays separate and labelled" : ""}.</>}</p>
        <RigEditor value={rig} onChange={setRig} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SaveStatus state={busy ? "saving" : error ? "failed" : dirty ? "unsaved" : "idle"} error={error} className="mr-auto" />
        <Button onClick={async () => { if (await confirmLeave()) router.back(); }}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save tone"}</Button>
      </div>
    </form>
  );
}
