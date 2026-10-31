"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Dialog from "@/components/app/Dialog";
import { Button, IconButton } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import { projectQuery } from "@/lib/queries/projects";

type Source = { canvasId: string; takes: { id: string; label: string }[] } | { takeId: string };
type Credit = { handle: string; role: string };

/**
 * Publish finished music to your profile and the feed: a song (with its
 * chart) and/or a take, a description, and credits for the people who made it
 * (you and members of its project).
 */
export default function PublishDialog({ open, onClose, userId, title, projectId, source }: { open: boolean; onClose: () => void; userId: string; title: string; projectId: string | null; source: Source }) {
  const router = useRouter();
  const me = useQuery({ queryKey: ["user", userId, "me"], queryFn: ({ signal }) => api<{ profile: { handle: string } }>("/api/me", { signal }).then((r) => r.profile), staleTime: 300_000, enabled: open });
  const project = useQuery({ ...projectQuery(userId, projectId ?? ""), enabled: open && !!projectId });
  const [name, setName] = useState(title);
  const [body, setBody] = useState("");
  const [takeId, setTakeId] = useState("canvasId" in source ? (source.takes[0]?.id ?? "") : "");
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Start with yourself; members of the project are offered to add.
  const list = credits ?? (me.data ? [{ handle: me.data.handle, role: "canvasId" in source ? "Songwriter" : "Performer" }] : []);
  const people = project.data?.members.map((m) => m.handle) ?? (me.data ? [me.data.handle] : []);
  const set = (i: number, patch: Partial<Credit>) => setCredits(list.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const release = "canvasId" in source ? { canvasId: source.canvasId, ...(takeId && { takeId }) } : { takeId: source.takeId };
      const { post } = await api<{ post: { id: string } }>("/api/posts", { body: { title: name.trim() || title, body, category: "ORIGINAL", release: { ...release, credits: list.filter((c) => c.handle && c.role.trim()) } } });
      router.push(`/p/${post.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title="Publish" onClose={onClose} wide>
      <div className="space-y-4">
        <label className="block"><span className="label-engraved">Title</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body outline-none" /></label>
        {"canvasId" in source && (
          <label className="block"><span className="label-engraved">Recording</span>
            <select value={takeId} onChange={(e) => setTakeId(e.target.value)} className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-sm">
              <option value="">No recording (lyrics and chords only)</option>
              {source.takes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
        )}
        <label className="block"><span className="label-engraved">About it</span><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={10_000} rows={3} placeholder="The story behind it, what to listen for, gear used…" className="panel-inset mt-2 w-full rounded-xl p-3 font-body text-sm outline-none" /></label>
        <fieldset className="space-y-2">
          <legend className="label-engraved">Credits</legend>
          {list.map((c, i) => (
            <div key={i} className="flex gap-2">
              <label className="w-40"><span className="sr-only">Who</span>
                <select value={c.handle} onChange={(e) => set(i, { handle: e.target.value })} className="panel-inset h-10 w-full rounded-lg px-2 font-body text-sm">
                  {[...new Set([c.handle, ...people])].map((h) => <option key={h} value={h}>@{h}</option>)}
                </select>
              </label>
              <label className="min-w-0 flex-1"><span className="sr-only">Role</span><input value={c.role} onChange={(e) => set(i, { role: e.target.value })} maxLength={40} placeholder="Guitar, vocals, lyrics, mix…" className="panel-inset h-10 w-full rounded-lg px-3 font-body text-sm outline-none" /></label>
              <IconButton icon="close" label={`Remove credit for @${c.handle}`} onClick={() => setCredits(list.filter((_, k) => k !== i))} size={36} />
            </div>
          ))}
          {list.length < 12 && people.length > 0 && <Button size="sm" variant="ghost" icon="plus" onClick={() => setCredits([...list, { handle: people.find((h) => !list.some((c) => c.handle === h)) ?? people[0], role: "" }])}>Add a credit</Button>}
          <p className="font-body text-xs text-muted">{projectId ? "You can credit anyone who has been in the project." : "Only you can be credited on music outside a project."}</p>
        </fieldset>
        <p className="rounded-xl border border-line p-3 font-body text-xs text-muted">This posts to your profile and the community feed. Anyone who can see the post can play this recording; your other takes, riffs and notes stay private.</p>
        {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
        {/* Pinned to the bottom of the sheet so the action stays reachable on phones. */}
        <div className="sticky -bottom-5 -mx-5 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3 sm:-bottom-6 sm:-mx-6 sm:px-6">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="share" disabled={busy || !me.data} onClick={publish}>{busy ? "Publishing…" : "Publish"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
