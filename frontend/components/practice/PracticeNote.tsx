"use client";

import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/app/ui";
import { PRACTICE_NOTE_KEY, readPracticeNote } from "@/lib/practice";

export default function PracticeNote() {
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    // Browser storage is read only after hydration; never overwrite it during mount.
    const frame = requestAnimationFrame(() => {
      try {
        const saved = readPracticeNote(localStorage.getItem(PRACTICE_NOTE_KEY));
        setGoal(saved.goal); setNotes(saved.notes);
      } catch { setStatus("Browser storage is unavailable. You can still write here for this visit."); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function save() {
    try { localStorage.setItem(PRACTICE_NOTE_KEY, JSON.stringify({ goal, notes })); setStatus("Saved in this browser."); }
    catch { setStatus("Could not save. Keep a copy of your note before leaving."); }
  }

  return (
    <section aria-labelledby="note-h" className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="note-h" className="font-display text-2xl font-semibold">Leave yourself a way back.</h2><span className="label-engraved">03 / Reflect</span></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <label className="block"><span className="label-engraved">One thing to work on</span><input maxLength={160} value={goal} onChange={(e) => { setGoal(e.target.value); setStatus("Unsaved changes"); }} placeholder="Land the chorus changes cleanly at 80 BPM" className="panel-inset mt-2 h-12 w-full rounded-xl px-4 text-sm" /><span className="mt-2 block text-xs text-muted">A small, specific goal beats another hour of noodling.</span></label>
        <label className="block"><span className="label-engraved">What worked? What is next?</span><textarea maxLength={2000} rows={3} value={notes} onChange={(e) => { setNotes(e.target.value); setStatus("Unsaved changes"); }} placeholder="Clean at 70. Rushing the last beat at 80. Next time: two bars, lighter touch." className="panel-inset mt-2 w-full resize-y rounded-xl p-4 text-sm" /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={save} icon="bookmark">Save practice note</Button><LinkButton href="/new?prompt=feedback" icon="comment">Ask for feedback</LinkButton><Button variant="ghost" onClick={() => { try { localStorage.removeItem(PRACTICE_NOTE_KEY); setGoal(""); setNotes(""); setStatus("Practice note cleared."); } catch { setStatus("Could not clear browser storage."); } }}>Clear note</Button></div>
      <p role="status" className="mt-3 text-sm text-signal">{status}</p>
      <p className="mt-2 text-xs text-muted">Notes stay in this browser, including on shared devices. They do not sync to your account or get added to a post. Clear them when you are done on a shared device.</p>
    </section>
  );
}
