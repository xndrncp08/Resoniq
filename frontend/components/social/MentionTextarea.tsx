"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/app/ui";
import { api } from "@/lib/client-api";

type Musician = { id: string; handle: string; name: string | null; image: string | null };

// The @handle being typed right before the caret.
const TYPING = /(^|[^\w@])@([a-z0-9_]{2,30})$/i;

/**
 * A textarea that suggests musicians as you type @handle. Arrow keys move
 * through the suggestions, Enter or Tab inserts one, Escape closes the list;
 * everything else behaves like a normal textarea.
 */
export default function MentionTextarea({ value, onValueChange, ...props }: Omit<ComponentProps<"textarea">, "value" | "onChange"> & { value: string; onValueChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const list = useId();
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState<string | null>(null);
  const typing = TYPING.exec(value.slice(0, caret))?.[2]?.toLowerCase() ?? null;
  const [term, setTerm] = useState<string | null>(null);
  // A short pause before searching, so each keystroke isn't a request.
  useEffect(() => {
    const t = setTimeout(() => setTerm(typing), 180);
    return () => clearTimeout(t);
  }, [typing]);
  const query = useQuery<Musician[]>({
    queryKey: ["mention-search", term],
    queryFn: ({ signal }) => api<{ items: Musician[] }>(`/api/search?type=musicians&q=${encodeURIComponent(term!)}`, { signal }).then((r) => r.items.slice(0, 6)),
    enabled: !!term,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const options = typing && typing !== closed ? query.data ?? [] : [];
  const open = options.length > 0;
  const index = Math.min(active, options.length - 1);

  function insert(m: Musician) {
    const before = value.slice(0, caret).replace(TYPING, (_all, lead: string) => `${lead}@${m.handle} `);
    const next = before + value.slice(caret);
    onValueChange(next);
    setActive(0);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(before.length, before.length);
      setCaret(before.length);
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        {...props}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={list}
        aria-activedescendant={open ? `${list}-${index}` : undefined}
        onChange={(e) => { onValueChange(e.target.value); setCaret(e.target.selectionStart); setActive(0); }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive((index + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insert(options[index]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setClosed(typing);
              return;
            }
          }
          props.onKeyDown?.(e);
        }}
      />
      <ul id={list} role="listbox" aria-label="Mention a musician" hidden={!open} className="panel absolute left-2 right-2 top-full z-30 mt-1 max-w-sm overflow-hidden p-1 shadow-panel">
        {options.map((m, i) => (
          <li
            key={m.id}
            id={`${list}-${i}`}
            role="option"
            aria-selected={i === index}
            onMouseDown={(e) => { e.preventDefault(); insert(m); }}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === index ? "bg-white/[0.07]" : ""}`}
          >
            <Avatar user={m} size={28} />
            <span className="min-w-0 truncate font-body text-sm">{m.name ?? m.handle} <span className="font-mono text-xs text-muted">@{m.handle}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
