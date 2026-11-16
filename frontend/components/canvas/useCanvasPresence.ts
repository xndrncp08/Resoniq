"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import { canvasKeys } from "@/lib/queries/canvases";
import type { CanvasPresence, CanvasView } from "@/lib/canvas/service";

/**
 * Who else has this song open, and where. One small request every 2.5 s
 * while the tab is visible (15 s when hidden); it also carries the song's
 * version, and only a newer version triggers fetching the song itself.
 * Moving to another section reports it straight away.
 */
export function useCanvasPresence(userId: string, id: string, sectionId: string | null) {
  const client = useQueryClient();
  const [present, setPresent] = useState<CanvasPresence["present"]>([]);
  const section = useRef(sectionId);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let running = false;
    let pending = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      clearTimeout(timer);
      // Coalesce section/focus changes while a request is running; never overlap heartbeats.
      if (running) { pending = true; return; }
      running = true;
      try {
        const r = await api<CanvasPresence>(`/api/canvases/${id}/presence`, { body: { sectionId: section.current }, signal: controller.signal });
        if (!alive) return;
        setPresent(r.present);
        const cached = client.getQueryData<CanvasView>(canvasKeys.one(userId, id));
        if (cached && r.version > cached.version) void client.invalidateQueries({ queryKey: canvasKeys.one(userId, id) });
      } catch {
        // Offline for a moment: keep the last known presence and try again on the next tick.
      }
      running = false;
      if (alive) {
        const delay = pending ? 0 : document.visibilityState === "visible" ? 2500 : 15_000;
        pending = false;
        timer = setTimeout(tick, delay);
      }
    };
    kick.current = () => void tick();
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => { alive = false; controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [client, userId, id]);

  useEffect(() => {
    if (section.current === sectionId) return;
    section.current = sectionId;
    kick.current();
  }, [sectionId]);

  return present;
}
