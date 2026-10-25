"use client";

import { useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { GearRef } from "@/types/rig";

type Item = { id: string; brand: string; model: string; controls: string[]; status: string };

/** Search the catalog, or keep whatever was typed as custom gear. */
export default function GearPicker({ kind, value, onChange, placeholder }: { kind: string | string[]; value?: GearRef; onChange: (ref: GearRef | undefined, controls?: string[]) => void; placeholder: string }) {
  const id = useId();
  const [q, setQ] = useState(value ? [value.brand, value.model].filter(Boolean).join(" ") : "");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(q.trim());
  const kinds = Array.isArray(kind) ? kind : [kind];
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);
  // Catalog lookups are cached, so retyping or reopening a picker answers instantly.
  const { data: items = [] } = useQuery({
    queryKey: ["gear", "search", kinds, term],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(kinds.map((k) => api<{ items: Item[] }>(`/api/gear?q=${encodeURIComponent(term)}&kind=${k}&limit=6`, { signal }).catch(() => ({ items: [] }))));
      return results.flatMap((r) => r.items).slice(0, 8);
    },
    enabled: open && term.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const shown = open && q.trim().length >= 2 ? items : [];

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          // Until a catalog item is picked, the text itself is custom gear.
          onChange(e.target.value.trim() ? { model: e.target.value.trim().slice(0, 120) } : undefined);
        }}
        className="panel-inset h-10 w-full rounded-xl px-3 font-body text-sm text-ink outline-none placeholder:text-muted focus:border-copper/60"
      />
      {shown.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="panel absolute z-30 mt-1 max-h-64 w-full overflow-y-auto p-1 shadow-panel">
          {shown.map((g) => (
            <li key={g.id} role="option" aria-selected={value?.gearId === g.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQ(`${g.brand} ${g.model}`);
                  onChange({ gearId: g.id, brand: g.brand, model: g.model }, g.controls);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-body text-sm hover:bg-white/[0.05]"
              >
                <span><span className="text-muted">{g.brand}</span> {g.model}</span>
                {g.status === "PENDING" && <span className="font-mono text-[10px] text-amber">pending</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && !value.gearId && <p className="mt-1 font-mono text-[10.5px] text-muted">Custom gear · not in the catalog</p>}
    </div>
  );
}
