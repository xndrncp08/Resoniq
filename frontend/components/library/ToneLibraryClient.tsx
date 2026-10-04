"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, Star, Pencil, Trash2, Link2, Check } from "lucide-react";
import type { ToneRecipe } from "@/types/tone";
import { recipeSearchText, recipeTags } from "@/lib/recipe-tags";

const FAVORITES = "Favorites";

export default function ToneLibraryClient({ initialTones }: { initialTones: ToneRecipe[] }) {
  const [tones, setTones] = useState<ToneRecipe[]>(initialTones);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tagsById = useMemo(() => new Map(tones.map((t) => [t.id, recipeTags(t)])), [tones]);

  // Tags present in the library, most common first.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tags of tagsById.values()) for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
  }, [tagsById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tones.filter((t) => {
      if (q && !recipeSearchText(t).includes(q)) return false;
      for (const tag of activeTags) {
        if (tag === FAVORITES ? !t.isFavorite : !tagsById.get(t.id)?.includes(tag)) return false;
      }
      return true;
    });
  }, [tones, query, activeTags, tagsById]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  /** Optimistic update; rolls back and reports if the request fails. */
  async function mutate(id: string, patch: Partial<ToneRecipe>, request: () => Promise<Response>, failure: string) {
    const before = tones;
    setTones((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setError(null);
    try {
      if (!(await request()).ok) throw new Error();
    } catch {
      setTones(before);
      setError(failure);
    }
  }

  function toggleFavorite(tone: ToneRecipe) {
    const isFavorite = !tone.isFavorite;
    return mutate(
      tone.id,
      { isFavorite },
      () =>
        fetch(`/api/tones/${tone.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite: isFavorite }),
        }),
      "Couldn't update favorite. Try again.",
    );
  }

  function commitRename(tone: ToneRecipe) {
    setEditingId(null);
    const title = draftName.trim();
    if (!title || title === tone.title) return;
    return mutate(
      tone.id,
      { title },
      () =>
        fetch(`/api/tones/${tone.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: title }),
        }),
      "Couldn't rename. Try again.",
    );
  }

  async function remove(tone: ToneRecipe) {
    setConfirmingDeleteId(null);
    const before = tones;
    setTones((list) => list.filter((t) => t.id !== tone.id));
    try {
      if (!(await fetch(`/api/tones/${tone.id}`, { method: "DELETE" })).ok) throw new Error();
    } catch {
      setTones(before);
      setError("Couldn't delete. Try again.");
    }
  }

  async function share(tone: ToneRecipe) {
    const url = `${window.location.origin}/t/${tone.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setError(null);
      setCopiedId(tone.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard access can be denied (permissions, insecure context).
      setError(`Couldn't copy the link. Share this URL instead: ${url}`);
    }
  }

  const chip = (tag: string) => {
    const active = activeTags.has(tag);
    return (
      <button
        key={tag}
        type="button"
        aria-pressed={active}
        onClick={() => toggleTag(tag)}
        className={`focus-ring flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] transition ${
          active ? "border-copper bg-copper/10 text-ink" : "border-white/10 text-muted hover:text-ink"
        }`}
      >
        {tag === FAVORITES && <Star size={11} fill={active ? "currentColor" : "none"} className={active ? "text-copper" : ""} />}
        {tag}
      </button>
    );
  };

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tones, amps, pedals, artists…"
          aria-label="Search tones"
          className="focus-ring w-full rounded-full border border-white/10 bg-white/[0.03] py-2.5 pl-11 pr-4 font-body text-sm outline-none"
        />
      </div>

      {tones.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2" aria-label="Filter by tag">
          {chip(FAVORITES)}
          {allTags.map(chip)}
          {activeTags.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveTags(new Set())}
              className="focus-ring rounded-full px-3 py-1 font-mono text-[11px] text-muted underline-offset-2 hover:underline"
            >
              clear
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 font-body text-sm text-danger">
          {error}
        </p>
      )}

      {filtered.length === 0 && (
        <p className="font-body text-sm text-muted">
          {tones.length === 0 ? (
            <>
              No saved tones yet.{" "}
              <Link href="/analyze" className="text-copper underline-offset-2 hover:underline">
                Analyze a song
              </Link>{" "}
              and save the result to see it here.
            </>
          ) : (
            "No tones match your search and filters."
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tone, i) => (
          <motion.article
            key={tone.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03 }}
            className="glass flex flex-col rounded-panel p-6"
          >
            <div className="flex items-start justify-between gap-2">
              {editingId === tone.id ? (
                <input
                  autoFocus
                  aria-label="Tone name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(tone)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(tone);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="focus-ring w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 font-body text-sm outline-none"
                />
              ) : (
                <Link href={`/t/${tone.id}`} className="focus-ring rounded font-display text-base font-medium hover:text-copper">
                  {tone.title}
                </Link>
              )}
              <button
                onClick={() => toggleFavorite(tone)}
                className="focus-ring flex-shrink-0 text-muted transition hover:text-copper"
                aria-label={tone.isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={tone.isFavorite}
              >
                <Star size={16} fill={tone.isFavorite ? "currentColor" : "none"} className={tone.isFavorite ? "text-copper" : ""} />
              </button>
            </div>

            <p className="mt-1 font-body text-xs text-muted">{tone.artist}</p>
            <p className="mt-3 font-mono text-[11px] text-muted">
              {tone.amp.model} · gain {tone.amp.gain}
            </p>

            <ul className="mt-3 flex flex-wrap gap-1">
              {tagsById.get(tone.id)?.map((tag) => (
                <li key={tag} className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted">
                  {tag}
                </li>
              ))}
            </ul>

            <div className="mt-auto flex gap-2 pt-5">
              <button
                onClick={() => {
                  setEditingId(tone.id);
                  setDraftName(tone.title);
                }}
                className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-2 font-body text-xs text-muted transition hover:bg-white/[0.05] hover:text-ink"
              >
                <Pencil size={13} /> Rename
              </button>
              <button
                onClick={() => share(tone)}
                className="focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-2 font-body text-xs text-muted transition hover:bg-white/[0.05] hover:text-ink"
              >
                {copiedId === tone.id ? <Check size={13} /> : <Link2 size={13} />}
                {copiedId === tone.id ? "Copied" : "Share"}
              </button>
              {confirmingDeleteId === tone.id ? (
                <button
                  onClick={() => remove(tone)}
                  onBlur={() => setConfirmingDeleteId(null)}
                  autoFocus
                  className="focus-ring flex items-center justify-center rounded-full border border-danger/50 bg-danger/10 px-3 py-2 font-body text-xs text-danger transition"
                  aria-label={`Confirm: delete ${tone.title} permanently`}
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={() => setConfirmingDeleteId(tone.id)}
                  className="focus-ring flex items-center justify-center rounded-full border border-white/10 px-3 py-2 text-muted transition hover:border-danger/40 hover:text-danger"
                  aria-label={`Delete ${tone.title}`}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
