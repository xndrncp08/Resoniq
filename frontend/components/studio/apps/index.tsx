"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import Skeleton from "@/components/ui/Skeleton";
import type { AppKey, AppProps } from "@/lib/studio/types";

export type AppComponentProps = { windowId: string; props: AppProps };

const loading = () => (
  <div className="space-y-3 p-4" aria-busy="true">
    <Skeleton className="h-6 w-1/3 rounded-lg" />
    <Skeleton className="h-28" />
    <Skeleton className="h-28" />
  </div>
);

/**
 * Each app is its own chunk, fetched the first time a window of that kind
 * opens, so a desktop with only the song list never downloads the tone
 * dashboard. App bodies render client-side only: they load their own data.
 */
export const APP_COMPONENTS: Record<AppKey, ComponentType<AppComponentProps>> = {
  songs: dynamic(() => import("./SongsApp"), { ssr: false, loading }),
  tone: dynamic(() => import("./ToneApp"), { ssr: false, loading }),
  library: dynamic(() => import("./LibraryApp"), { ssr: false, loading }),
  upload: dynamic(() => import("./UploadApp"), { ssr: false, loading }),
  "amp-lab": dynamic(() => import("./AmpLabApp"), { ssr: false, loading }),
  shortcuts: dynamic(() => import("./ShortcutsApp"), { ssr: false, loading }),
};
