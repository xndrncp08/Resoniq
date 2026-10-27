"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar, TimeAgo } from "@/components/app/ui";
import Icon from "@/components/icons/Icon";
import { api } from "@/lib/client-api";
import type { ConversationSummary } from "@/lib/messaging-shared";

/** The inbox: direct conversations and projects, newest activity first, refreshed while visible. */
export default function ConversationList({ userId, kind, initial }: { userId: string; kind: "DIRECT" | "PROJECT" | null; initial: ConversationSummary[] }) {
  const { data = initial } = useQuery({
    queryKey: ["user", userId, "conversations", kind ?? "all"],
    queryFn: ({ signal }) => api<{ items: ConversationSummary[] }>(`/api/conversations${kind ? `?kind=${kind}` : ""}`, { signal }).then((r) => r.items),
    initialData: initial,
    initialDataUpdatedAt: () => Date.now(),
    refetchInterval: 15_000,
  });
  if (!data.length) return null;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {data.map((c) => {
        const others = c.members.filter((m) => m.id !== userId);
        return (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} className="focus-ring flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
              {c.kind === "PROJECT" ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-copper/12 text-copper"><Icon name="users" size={22} /></span>
              ) : (
                <Avatar user={others[0] ?? { handle: "?", name: null, image: null }} size={44} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`truncate font-body text-[15px] ${c.unread ? "font-semibold text-ink" : "text-ink-dim"}`}>{c.title}</span>
                  {c.kind === "PROJECT" && <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-copper">Project · {c.members.length}</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-2 font-body text-sm text-muted">
                  {c.pendingInvite && <span className="shrink-0 rounded-full bg-signal/15 px-2 py-0.5 text-[11px] font-medium text-signal">Invite</span>}
                  <span className="truncate">{c.last ? `${c.last.author}: ${c.last.body}` : "No messages yet"}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                {c.last && <TimeAgo iso={c.last.at} className="font-mono text-[11px] text-muted" />}
                {c.unread && <span className="h-2.5 w-2.5 rounded-full bg-signal" aria-label="Unread" />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
