"use client";

import { memo } from "react";
import { Upload } from "lucide-react";
import Feedback from "@/components/ui/Feedback";
import Skeleton from "@/components/ui/Skeleton";
import { useWindowStoreApi } from "@/lib/studio/store-context";
import type { AppComponentProps } from "@/components/studio/apps";
import { useFetchJson } from "@/components/studio/apps/use-fetch-json";

type Song = { id: string; title: string | null; artist: string | null; status: string; durationSec: number | null; createdAt: string };

const STATUS: Record<string, string> = {
  UPLOADED: "queued",
  ANALYZING: "analyzing",
  ANALYZED: "ready",
  FAILED: "failed",
};

const fmtDuration = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

function SongsApp(_: AppComponentProps) {
  const store = useWindowStoreApi();
  const { data, error, loading } = useFetchJson<{ songs: Song[] }>("/api/songs", { refetchOnDataChange: true });

  if (loading) {
    return (
      <div className="space-y-2 p-3" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }
  if (error) return <Feedback tone="error" className="p-4 font-body text-sm">{error}</Feedback>;

  const songs = data?.songs ?? [];
  if (!songs.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-body text-sm text-muted">No uploads yet.</p>
        <button
          type="button"
          onClick={() => store.getState().openWindow("upload")}
          className="focus-ring flex items-center gap-2 rounded-full bg-copper px-4 py-2 font-body text-sm font-semibold text-bg"
        >
          <Upload size={14} aria-hidden /> Upload a song
        </button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.05] p-2" aria-label="Your songs">
      {songs.map((song) => {
        const title = song.title ?? "Untitled upload";
        return (
          <li key={song.id}>
            <button
              type="button"
              onClick={() => store.getState().openWindow("tone", { props: { songId: song.id }, title })}
              className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-sm text-ink">{title}</span>
                <span className="block truncate font-mono text-[10px] text-muted">
                  {[song.artist, fmtDuration(song.durationSec)].filter(Boolean).join(" · ") || new Date(song.createdAt).toLocaleDateString()}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
                  song.status === "ANALYZED" ? "bg-signal/10 text-signal" : song.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-white/[0.06] text-muted"
                }`}
              >
                {STATUS[song.status] ?? song.status.toLowerCase()}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(SongsApp);
