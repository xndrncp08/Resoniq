"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import { INSTRUMENTS, INSTRUMENT_LABEL } from "@/lib/instruments";
import { TONE_GENRES } from "@/lib/tones";

const chip = (on: boolean) => `focus-ring rounded-full border px-3 py-2 font-body text-sm disabled:opacity-40 ${on ? "border-copper bg-copper/10 text-ink" : "border-line text-muted"}`;

/** What you play and what you're into: the same public profile fields as Settings, picked in one go. */
export default function InterestsStep({ instruments: initialInstruments, genres: initialGenres }: { instruments: string[]; genres: string[] }) {
  const router = useRouter();
  const [instruments, setInstruments] = useState(initialInstruments);
  const [genres, setGenres] = useState(initialGenres);
  const [other, setOther] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string; saved?: boolean }>({});
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addOther = () => {
    const g = other.trim().toLowerCase();
    if (g && !genres.includes(g) && genres.length < 8) setGenres([...genres, g]);
    setOther("");
  };

  async function save() {
    setState({ busy: true });
    try {
      await api("/api/me", { method: "PATCH", body: { instruments, genres } });
      setState({ saved: true });
      router.refresh();
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label-engraved">I play (up to 4)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INSTRUMENTS.map((k) => {
            const on = instruments.includes(k);
            return <button key={k} type="button" aria-pressed={on} disabled={!on && instruments.length >= 4} onClick={() => setInstruments(toggle(instruments, k))} className={chip(on)}>{INSTRUMENT_LABEL[k]}</button>;
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label-engraved">I&apos;m into (up to 8)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...new Set([...TONE_GENRES, ...genres])].map((g) => {
            const on = genres.includes(g);
            return <button key={g} type="button" aria-pressed={on} disabled={!on && genres.length >= 8} onClick={() => setGenres(toggle(genres, g))} className={chip(on)}>{g}</button>;
          })}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addOther(); }}>
          <label className="min-w-0 flex-1"><span className="sr-only">Another genre</span><input value={other} onChange={(e) => setOther(e.target.value)} maxLength={40} placeholder="Something else? e.g. math rock" className="panel-inset h-10 w-full rounded-lg px-3 font-body text-sm outline-none" /></label>
          <Button size="sm" type="submit" disabled={!other.trim() || genres.length >= 8}>Add</Button>
        </form>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={state.busy || !instruments.length || !genres.length} onClick={save}>{state.busy ? "Saving…" : "Save"}</Button>
        <p role="status" className="font-body text-sm text-muted">{state.error ? <span className="text-danger">{state.error}</span> : state.saved ? "Saved. Suggestions below now match what you play." : !instruments.length || !genres.length ? "Pick at least one of each." : ""}</p>
      </div>
      <p className="font-body text-xs text-muted">These show on your profile and help other musicians find you. You can change them any time in Settings.</p>
    </div>
  );
}
