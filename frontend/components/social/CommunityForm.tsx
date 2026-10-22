"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, IconButton } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";

const KINDS = [["GENRE", "Genre"], ["INSTRUMENT", "Instrument"], ["GEAR", "Gear"], ["STYLE", "Playing style"], ["TOPIC", "Topic"]] as const;
const slugify = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

export default function CommunityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("TOPIC");
  const [rules, setRules] = useState([{ title: "Be kind; critique the tone, not the player", body: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveSlug = slug || slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { community } = await api<{ community: { slug: string } }>("/api/communities", { body: { name, slug: effectiveSlug, description, kind, rules: rules.filter((r) => r.title.trim()) } });
      router.push(`/c/${community.slug}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  const field = "panel-inset mt-2 w-full rounded-xl px-3 font-body outline-none focus:border-copper/60";
  return (
    <form onSubmit={submit} className="panel space-y-5 p-5 sm:p-6">
      <label className="block"><span className="label-engraved">Name</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={40} className={`${field} h-11`} /></label>
      <label className="block">
        <span className="label-engraved">Address</span>
        <div className="mt-2 flex items-center gap-1 font-mono text-sm text-muted">resoniq/c/<input value={effectiveSlug} onChange={(e) => setSlug(slugify(e.target.value))} required className="panel-inset h-10 flex-1 rounded-xl px-3 text-ink outline-none" aria-label="Address" /></div>
      </label>
      <fieldset>
        <legend className="label-engraved mb-2">Type</legend>
        <div className="flex flex-wrap gap-2">{KINDS.map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1.5 font-body text-sm ${kind === k ? "border-copper bg-copper/10" : "border-line text-muted"}`}>{l}</button>)}</div>
      </fieldset>
      <label className="block"><span className="label-engraved">Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className={`${field} py-2`} /></label>
      <fieldset className="space-y-2">
        <legend className="label-engraved mb-2">Rules</legend>
        {rules.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input value={r.title} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={80} placeholder={`Rule ${i + 1}`} aria-label={`Rule ${i + 1}`} className="panel-inset h-10 flex-1 rounded-xl px-3 font-body text-sm outline-none" />
            <IconButton icon="close" label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, j) => j !== i))} />
          </div>
        ))}
        {rules.length < 10 && <Button size="sm" icon="plus" onClick={() => setRules([...rules, { title: "", body: "" }])}>Add rule</Button>}
      </fieldset>
      {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={busy}>{busy ? "Creating…" : "Create community"}</Button>
    </form>
  );
}
