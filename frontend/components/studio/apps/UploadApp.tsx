"use client";

import { memo, useCallback } from "react";
import UploadPanel from "@/components/audio/UploadPanel";
import { notifyDataChanged } from "@/lib/studio/events";
import { useWindowStoreApi } from "@/lib/studio/store-context";
import type { AppComponentProps } from "@/components/studio/apps";

/** Upload in a window; a finished upload opens its tone window instead of navigating away. */
function UploadApp(_: AppComponentProps) {
  const store = useWindowStoreApi();
  const onUploaded = useCallback(
    (songId: string, title: string) => {
      notifyDataChanged();
      store.getState().openWindow("tone", { props: { songId }, title });
    },
    [store],
  );
  return (
    <div className="p-4">
      <UploadPanel onUploaded={onUploaded} />
    </div>
  );
}

export default memo(UploadApp);
