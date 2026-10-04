"use client";

import { memo } from "react";
import ToneLibraryClient from "@/components/library/ToneLibraryClient";
import Feedback from "@/components/ui/Feedback";
import Skeleton from "@/components/ui/Skeleton";
import type { ToneRecipe } from "@/types/tone";
import type { AppComponentProps } from "@/components/studio/apps";
import { useFetchJson } from "@/components/studio/apps/use-fetch-json";

function LibraryApp(_: AppComponentProps) {
  const { data, error, loading } = useFetchJson<{ tones: ToneRecipe[] }>("/api/library", { refetchOnDataChange: true });
  if (loading && !data) {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44" />)}
      </div>
    );
  }
  if (error && !data) return <Feedback tone="error" className="p-4 font-body text-sm">{error}</Feedback>;
  // Keyed by content so a refetch (a tone saved in another window) resets the list.
  const tones = data?.tones ?? [];
  return (
    <div className="p-4">
      <ToneLibraryClient key={tones.map((t) => `${t.id}:${t.title}:${t.isFavorite}`).join("|")} initialTones={tones} />
    </div>
  );
}

export default memo(LibraryApp);
