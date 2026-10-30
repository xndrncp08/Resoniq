"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientApiError, api } from "@/lib/client-api";
import { canvasKeys, canvasQuery, useSaveCanvas } from "@/lib/queries/canvases";
import { mergeCanvas, type CanvasContent } from "@/lib/canvas/merge";
import type { CanvasView } from "@/lib/canvas/service";

const contentOf = (c: CanvasView): CanvasContent => ({ title: c.title, key: c.key, bpm: c.bpm, sections: c.sections, arrangement: c.arrangement });
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const AUTOSAVE_MS = 1200;
let n = 0;
const copyId = () => `s${Date.now().toString(36)}${(n++).toString(36)}`;

export type DraftStatus = "saved" | "saving" | "unsaved" | "offline" | "error";

/**
 * The editor's local copy of a song, autosaved a moment after typing stops.
 * Others' saves arrive by polling: adopted directly when there are no local
 * edits, merged section by section when there are. A save that lost a race
 * (409) is merged with the newer version and sent again.
 */
export function useCanvasDraft(userId: string, initial: CanvasView) {
  const client = useQueryClient();
  const remote = useQuery({ ...canvasQuery(userId, initial.id), initialData: initial }).data;
  const save = useSaveCanvas(userId, initial.id);
  const [synced, setSynced] = useState(initial);
  const [draft, setDraft] = useState(() => contentOf(initial));
  const [notices, setNotices] = useState<string[]>([]);
  const [status, setStatus] = useState<DraftStatus>("saved");
  const inFlight = useRef(false);
  const retry = useRef(0);

  const dirty = !eq(contentOf(synced), draft);

  // A newer version arrived (someone else saved, or our own save returned): adopt or merge it. Done during render, not in an effect.
  if (remote.version > synced.version && !inFlight.current) {
    if (!dirty) {
      setSynced(remote);
      setDraft(contentOf(remote));
    } else {
      const { merged, conflicts } = mergeCanvas(contentOf(synced), draft, contentOf(remote), copyId);
      setSynced(remote);
      setDraft(merged);
      if (conflicts.length) setNotices((x) => [...x, ...conflicts]);
    }
  }

  useEffect(() => {
    if (!dirty || inFlight.current) return;
    const t = setTimeout(async () => {
      inFlight.current = true;
      setStatus("saving");
      const sent = draft;
      try {
        const result = await save.mutateAsync({ baseVersion: synced.version, content: sent });
        retry.current = 0;
        inFlight.current = false;
        setSynced(result);
        setStatus("saved");
      } catch (err) {
        inFlight.current = false;
        if (err instanceof ClientApiError && err.status === 409) {
          // Someone saved first: fetch theirs and merge ours in; the next pass saves the result.
          const latest = (await api<{ canvas: CanvasView }>(`/api/canvases/${initial.id}`)).canvas;
          client.setQueryData(canvasKeys.one(userId, initial.id), latest);
          setStatus("unsaved");
        } else if (err instanceof ClientApiError && err.status < 500 && err.status !== 429) {
          setNotices((x) => [...x, err.message]);
          setStatus("error");
        } else {
          // Network trouble or overload: back off and try again (work stays in the editor).
          retry.current = Math.min(retry.current + 1, 5);
          setStatus("offline");
          setTimeout(() => setDraft((d) => ({ ...d })), 2000 * 2 ** retry.current);
        }
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, draft, synced.version, save, client, userId, initial.id]);

  return {
    canvas: synced,
    draft,
    setDraft,
    dirty,
    status: dirty && status === "saved" ? "unsaved" : status,
    notices,
    dismissNotices: () => setNotices([]),
    /** For leaving the page: wait until the latest edits are stored. */
    flush: async () => {
      if (!dirty) return;
      const result = await save.mutateAsync({ baseVersion: synced.version, content: draft });
      setSynced(result);
    },
  };
}
