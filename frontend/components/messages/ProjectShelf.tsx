"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/app/ui";
import StageStepper from "@/components/projects/StageStepper";
import { api, errorMessage } from "@/lib/client-api";
import { riffsQuery } from "@/lib/queries/riffs";
import { canvasesQuery, useCreateCanvas } from "@/lib/queries/canvases";
import type { RoomSummary } from "@/lib/rooms/service";

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{title}</h3>
      <ul className="space-y-1 font-body text-sm">{children}</ul>
    </div>
  );
}

/** What the project is working on: its riffs, songs and open listening rooms, a tap away from the conversation. */
export default function ProjectShelf({ userId, projectId }: { userId: string; projectId: string }) {
  const router = useRouter();
  const riffs = useQuery(riffsQuery(userId, { project: projectId }));
  const songs = useQuery(canvasesQuery(userId, projectId));
  const rooms = useQuery({ queryKey: ["user", userId, "rooms", projectId], queryFn: ({ signal }) => api<{ rooms: RoomSummary[] }>(`/api/rooms?project=${projectId}`, { signal }).then((r) => r.rooms), refetchInterval: 15_000 });
  const newSong = useCreateCanvas(userId);
  const [error, setError] = useState<string | null>(null);
  async function newRoom() {
    try {
      const { id } = await api<{ id: string }>("/api/rooms", { body: { projectId } });
      router.push(`/rooms/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  const empty = (text: string) => <li className="text-xs text-muted">{text}</li>;
  return (
    <section aria-label="Project shelf" className="space-y-3 rounded-xl border border-line bg-surface/40 p-3">
      <StageStepper userId={userId} projectId={projectId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Col title="Riffs">
          {riffs.data?.length ? riffs.data.slice(0, 5).map((r) => <li key={r.id}><Link href={`/riffs/${r.id}`} className="truncate text-ink-dim hover:text-ink">{r.title}</Link> <span className="text-xs text-muted">· {r.takes} take{r.takes === 1 ? "" : "s"}</span></li>) : empty("Share a riff from the Riff Vault (Start a project, or move one in).")}
        </Col>
        <Col title="Songs">
          {songs.data?.length ? songs.data.slice(0, 5).map((c) => <li key={c.id}><Link href={`/write/${c.id}`} className="truncate text-ink-dim hover:text-ink">{c.title}</Link></li>) : empty("No songs yet.")}
        </Col>
        <Col title="Listening rooms">
          {rooms.data?.length ? rooms.data.map((r) => <li key={r.id}><Link href={`/rooms/${r.id}`} className="text-ink-dim hover:text-ink">{r.title}</Link> <span className="text-xs text-muted">· {r.present} here</span></li>) : empty("No one's listening right now.")}
        </Col>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon="edit" disabled={newSong.isPending} onClick={() => newSong.mutate({ projectId }, { onSuccess: (c) => router.push(`/write/${c.id}`), onError: (e) => setError(errorMessage(e)) })}>New song</Button>
        <Button size="sm" icon="headphones" onClick={newRoom}>Listen together</Button>
      </div>
      {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
    </section>
  );
}
