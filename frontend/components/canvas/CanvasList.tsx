"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, TimeAgo } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";
import { canvasesQuery, useCreateCanvas } from "@/lib/queries/canvases";
import type { CanvasSummary } from "@/lib/canvas/service";

export default function CanvasList({ userId, initial }: { userId: string; initial: CanvasSummary[] }) {
  const router = useRouter();
  const list = useQuery({ ...canvasesQuery(userId), initialData: initial });
  const create = useCreateCanvas(userId);
  return (
    <div className="space-y-5">
      <Button variant="primary" icon="plus" disabled={create.isPending} onClick={() => create.mutate({}, { onSuccess: (c) => router.push(`/write/${c.id}`) })}>{create.isPending ? "Creating…" : "New song"}</Button>
      {create.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(create.error)}</p>}
      {list.data.length === 0 ? (
        <EmptyState icon="edit" title="No songs yet">Start from a blank page, or from a riff in the Riff Vault. Write lyrics with chords, shape the sections, and invite your band to write with you.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {list.data.map((c) => (
            <li key={c.id}>
              <Link href={`/write/${c.id}`} className="focus-ring flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{c.title}</span>
                <span className="font-body text-sm text-muted">{[c.key, `${c.sections} section${c.sections === 1 ? "" : "s"}`, c.project ? `in ${c.project.title ?? "a project"}` : "private"].filter(Boolean).join(" · ")} · <TimeAgo iso={c.updatedAt} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
