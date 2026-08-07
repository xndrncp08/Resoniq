"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Star, Pencil, Trash2, Link2, Check } from "lucide-react";

type Tone = {
  id: string;
  name: string;
  favorite: boolean;
  createdAt: string;
  data: { profile?: { amp_family?: string; gain_percent?: number } };
};

export default function ToneLibraryClient({
  initialTones,
}: {
  initialTones: Tone[];
}) {
  const [tones, setTones] = useState<Tone[]>(initialTones);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return tones;
    const q = query.toLowerCase();
    return tones.filter((t) => t.name.toLowerCase().includes(q));
  }, [tones, query]);

  async function toggleFavorite(tone: Tone) {
    setTones((list) =>
      list.map((t) => (t.id === tone.id ? { ...t, favorite: !t.favorite } : t)),
    );
    await fetch(`/api/tones/${tone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !tone.favorite }),
    });
  }

  async function commitRename(tone: Tone) {
    const name = draftName.trim() || tone.name;
    setTones((list) =>
      list.map((t) => (t.id === tone.id ? { ...t, name } : t)),
    );
    setEditingId(null);
    await fetch(`/api/tones/${tone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function remove(tone: Tone) {
    if (!confirm(`Delete "${tone.name}"? This can't be undone.`)) return;
    setTones((list) => list.filter((t) => t.id !== tone.id));
    await fetch(`/api/tones/${tone.id}`, { method: "DELETE" });
  }

  function share(tone: Tone) {
    const url = `${window.location.origin}/t/${tone.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(tone.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <div>
      <div className="relative mb-8 max-w-sm">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your tones…"
          className="focus-ring w-full rounded-full border border-white/10 bg-white/[0.03] py-2.5 pl-11 pr-4 font-body text-sm outline-none"
        />
      </div>

      {filtered.length === 0 && (
        <p className="font-body text-sm text-muted">
          {tones.length === 0
            ? "No saved tones yet — analyze a song and save the result to see it here."
            : "No tones match your search."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tone, i) => (
          <motion.div
            key={tone.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="glass rounded-panel p-6"
          >
            <div className="flex items-start justify-between gap-2">
              {editingId === tone.id ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(tone)}
                  onKeyDown={(e) => e.key === "Enter" && commitRename(tone)}
                  className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 font-body text-sm outline-none"
                />
              ) : (
                <span className="font-display text-base font-medium">
                  {tone.name}
                </span>
              )}
              <button
                onClick={() => toggleFavorite(tone)}
                className="focus-ring flex-shrink-0 text-muted transition hover:text-copper"
                aria-label="Favorite"
              >
                <Star
                  size={16}
                  fill={tone.favorite ? "currentColor" : "none"}
                  className={tone.favorite ? "text-copper" : ""}
                />
              </button>
            </div>

            {tone.data?.profile?.amp_family && (
              <p className="mt-2 font-mono text-[11px] text-muted">
                {tone.data.profile.amp_family} · gain{" "}
                {tone.data.profile.gain_percent}%
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setEditingId(tone.id);
                  setDraftName(tone.name);
                }}
                className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-2 font-body text-xs text-muted transition hover:bg-white/[0.05] hover:text-ink"
              >
                <Pencil size={13} /> Rename
              </button>
              <button
                onClick={() => share(tone)}
                className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-2 font-body text-xs text-muted transition hover:bg-white/[0.05] hover:text-ink"
              >
                {copiedId === tone.id ? (
                  <Check size={13} />
                ) : (
                  <Link2 size={13} />
                )}
                {copiedId === tone.id ? "Copied" : "Share"}
              </button>
              <button
                onClick={() => remove(tone)}
                className="focus-ring flex items-center justify-center rounded-full border border-white/10 px-3 py-2 text-muted transition hover:border-danger/40 hover:text-danger"
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
