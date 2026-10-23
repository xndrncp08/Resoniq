"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { Button, Provenance } from "@/components/app/ui";
import Uploader, { type UploadKinds } from "@/components/media/Uploader";
import RigEditor, { emptyRig, rigIsEmpty } from "@/components/tone/rig/RigEditor";
import { CATEGORY_META } from "@/components/social/categories";
import { api, errorMessage } from "@/lib/client-api";
import type { RigSpec } from "@/types/rig";

type Community = { slug: string; name: string; joined: boolean };
type Tone = { id: string; name: string; visibility: string };

export default function Composer({ communities, tones, initial, uploadKinds }: { communities: Community[]; tones: Tone[]; initial: { category?: string; community?: string; toneId?: string }; uploadKinds: UploadKinds }) {
  const router = useRouter();
  const [category, setCategory] = useState(initial.category && CATEGORY_META[initial.category] ? initial.category : "DISCUSSION");
  const [community, setCommunity] = useState(initial.community ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toneId, setToneId] = useState(initial.toneId ?? "");
  const [rigOpen, setRigOpen] = useState(false);
  const [rig, setRig] = useState<RigSpec>(emptyRig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTone = tones.find((t) => t.id === toneId);
  const canSubmit = !busy && !uploading && (body.trim() || title.trim() || mediaIds.length || toneId || !rigIsEmpty(rig));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let attachTone = toneId || null;
      // A rig written right here becomes a tone of its own, credited to the poster.
      if (!attachTone && rigOpen && !rigIsEmpty(rig)) {
        const { tone } = await api<{ tone: { id: string } }>("/api/tones", { body: { name: (title || "My rig").slice(0, 120), rig, visibility: "PUBLIC" } });
        attachTone = tone.id;
      }
      const { post } = await api<{ post: { id: string } }>("/api/posts", { body: { category, community: community || null, title, body, mediaIds, toneId: attachTone } });
      router.push(`/p/${post.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="label-engraved mb-2">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)} className={`focus-ring inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-body text-sm transition-colors ${category === key ? "border-copper bg-copper/10 text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink"}`}>
              <Icon name={meta.icon} size={17} className={category === key ? "text-copper" : ""} /> {meta.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label-engraved">Where</span>
        <select value={community} onChange={(e) => setCommunity(e.target.value)} className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-[15px] outline-none">
          <option value="">Your profile & followers</option>
          {communities.some((c) => c.joined) && (
            <optgroup label="Your communities">{communities.filter((c) => c.joined).map((c) => <option key={c.slug} value={c.slug}>c/{c.slug} — {c.name}</option>)}</optgroup>
          )}
          <optgroup label="All communities">{communities.filter((c) => !c.joined).map((c) => <option key={c.slug} value={c.slug}>c/{c.slug} — {c.name}</option>)}</optgroup>
        </select>
      </label>

      <div className="panel space-y-3 p-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Title (optional)" aria-label="Title" className="w-full bg-transparent font-display text-2xl font-semibold outline-none placeholder:text-muted/60" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} rows={5} placeholder="Tell the story behind the tone. Mention @musicians and add #tags." aria-label="Post text" className="w-full resize-y bg-transparent font-body text-[15px] leading-relaxed outline-none placeholder:text-muted" />
        <p className="text-right font-mono text-[11px] text-muted">{body.length.toLocaleString()} / 10,000</p>
      </div>

      {uploadKinds.images ? (
        <Uploader kinds={uploadKinds} onChange={(ids, busyNow) => { setMediaIds(ids); setUploading(busyNow); }} />
      ) : (
        uploadKinds.note && <p className="panel-inset rounded-2xl p-4 font-body text-sm text-muted">{uploadKinds.note}</p>
      )}

      <div className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon name="tone" className="text-copper" /> Attach your tone <span className="font-body text-sm font-normal text-muted">(optional)</span></h3>
          <Provenance kind="declared" />
        </div>
        {tones.length > 0 && (
          <select value={toneId} onChange={(e) => { setToneId(e.target.value); if (e.target.value) setRigOpen(false); }} aria-label="Attach a saved tone" className="panel-inset h-11 w-full rounded-xl px-3 font-body text-[15px] outline-none">
            <option value="">No saved tone</option>
            {tones.map((t) => <option key={t.id} value={t.id}>{t.name}{t.visibility === "PRIVATE" ? " (private: attaching makes it unlisted)" : ""}</option>)}
          </select>
        )}
        {selectedTone ? (
          <p className="font-body text-sm text-muted">Viewers can open <span className="text-ink">{selectedTone.name}</span> from this post and inspect, save or remix it.</p>
        ) : rigOpen ? (
          <RigEditor value={rig} onChange={setRig} />
        ) : (
          <Button size="sm" icon="signal-chain" onClick={() => setRigOpen(true)}>Describe the rig in this post</Button>
        )}
      </div>

      {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {uploading && <span className="font-body text-sm text-muted">Waiting for uploads…</span>}
        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit}>{busy ? "Posting…" : "Post"}</Button>
      </div>
    </form>
  );
}
