"use client";

import { memo, useCallback, useEffect } from "react";
import AnalysisRunner from "@/components/tone/AnalysisRunner";
import Feedback from "@/components/ui/Feedback";
import Skeleton from "@/components/ui/Skeleton";
import { useWindowStoreApi } from "@/lib/studio/store-context";
import type { EngineAnalysis } from "@/types/engine";
import type { AppComponentProps } from "@/components/studio/apps";
import { useFetchJson } from "@/components/studio/apps/use-fetch-json";

type SongResponse = {
  song: {
    id: string;
    title: string | null;
    artist: string | null;
    createdAt: string;
    status: string;
    analysisData: EngineAnalysis | null;
    analysisError: string | null;
  };
};

const BADGES: Record<string, string | null> = { UPLOADED: "queued", ANALYZING: "analyzing", ANALYZED: null, FAILED: "failed" };

/** One song's tone dashboard in a window: the same runner and dashboard as /analyze/[id]. */
function ToneApp({ windowId, props }: AppComponentProps) {
  const store = useWindowStoreApi();
  const { data, error, loading } = useFetchJson<SongResponse>(props.songId ? `/api/songs/${encodeURIComponent(props.songId)}` : null);
  const song = data?.song;

  useEffect(() => {
    if (song?.title) store.getState().setTitle(windowId, song.title);
  }, [song?.title, store, windowId]);

  const onStatusChange = useCallback((status: string) => store.getState().setBadge(windowId, BADGES[status] ?? null), [store, windowId]);

  if (loading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <Skeleton className="h-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error || !song) {
    return <Feedback tone="error" className="p-4 font-body text-sm">{error ?? "This song is no longer available."}</Feedback>;
  }

  return (
    <div className="p-4">
      <AnalysisRunner
        song={{ id: song.id, title: song.title, artist: song.artist, createdAt: song.createdAt }}
        initialStatus={song.status}
        initialError={song.analysisError}
        initialData={song.analysisData}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

export default memo(ToneApp);
