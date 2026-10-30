"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar, EmptyState, TimeAgo } from "@/components/app/ui";
import { PROJECT_STAGES, STAGE_LABEL } from "@/lib/projects-shared";
import { projectsQuery } from "@/lib/queries/projects";
import type { ProjectView } from "@/lib/projects";

export default function ProjectList({ userId, initial }: { userId: string; initial: ProjectView[] }) {
  const list = useQuery({ ...projectsQuery(userId), initialData: initial }).data;
  if (!list.length) return <EmptyState icon="users" title="No projects yet">Start one from a riff in the Riff Vault, or accept a collaboration invite. Projects gather the riffs, songs and listening sessions you make together.</EmptyState>;
  const groups = [["In progress", list.filter((p) => !p.completedAt)], ["Finished", list.filter((p) => p.completedAt)]] as const;
  return (
    <div className="space-y-8">
      {groups.map(([title, items]) => items.length > 0 && (
        <section key={title} aria-label={title} className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{title} · {items.length}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => {
              const at = PROJECT_STAGES.indexOf(p.stage);
              return (
                <li key={p.id}>
                  <Link href={`/messages/${p.id}`} className="focus-ring block h-full space-y-3 rounded-2xl border border-line bg-surface/50 p-4 hover:border-line-strong">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{p.title ?? "Untitled project"}</span>
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${p.completedAt ? "bg-signal/15 text-signal" : "bg-copper/15 text-copper"}`}>{p.completedAt ? "Finished" : STAGE_LABEL[p.stage]}</span>
                    </div>
                    <div className="flex gap-1" role="img" aria-label={`Stage ${at + 1} of ${PROJECT_STAGES.length}: ${STAGE_LABEL[p.stage]}${p.stageSet ? "" : " (suggested)"}`}>
                      {PROJECT_STAGES.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= at ? (p.completedAt ? "bg-signal" : "bg-copper") : "bg-line"}`} />)}
                    </div>
                    <p className="font-body text-xs text-muted">{p.counts.riffs} riff{p.counts.riffs === 1 ? "" : "s"} · {p.counts.takes} take{p.counts.takes === 1 ? "" : "s"} · {p.counts.songs} song{p.counts.songs === 1 ? "" : "s"}{p.counts.openRooms ? ` · ${p.counts.openRooms} listening now` : ""}</p>
                    <div className="flex items-center gap-2">
                      <span className="flex -space-x-2">{p.members.slice(0, 5).map((m) => <Avatar key={m.id} user={m} size={24} className="ring-2 ring-surface" />)}</span>
                      <span className="ml-auto font-body text-xs text-muted">Active <TimeAgo iso={p.lastActivity} /></span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
