"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Box, Check, CloudOff, Loader2 } from "lucide-react";
import DesktopCanvas from "@/components/studio/DesktopCanvas";
import Dock from "@/components/studio/Dock";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import { SHORTCUTS } from "@/lib/studio/shortcuts";
import { useWindowStore, useWindowStoreApi, WindowStoreProvider } from "@/lib/studio/store-context";
import { useWorkspaceAutosave, type SaveStatus } from "@/lib/studio/use-workspace-autosave";
import type { WorkspaceLayout } from "@/lib/studio/types";

export default function StudioShell({ initialLayout, userName }: { initialLayout: WorkspaceLayout | null; userName: string | null }) {
  return (
    <WindowStoreProvider initialLayout={initialLayout}>
      <Desktop firstVisit={!initialLayout} userName={userName} />
    </WindowStoreProvider>
  );
}

function Desktop({ firstVisit, userName }: { firstVisit: boolean; userName: string | null }) {
  const store = useWindowStoreApi();
  const saveStatus = useWorkspaceAutosave(store);

  // No saved layout yet: start from the default desktop.
  useEffect(() => {
    if (firstVisit && store.getState().order.length === 0) store.getState().resetLayout();
  }, [firstVisit, store]);

  useStudioShortcuts();

  return (
    // Transparent: the shared background scene (root layout) shows through.
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="z-[9000] flex h-10 flex-shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-bg/70 px-4 backdrop-blur-xl">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg" aria-label="Back to Resoniq">
          <Image src="/logo.svg" alt="" width={20} height={20} className="rounded" />
          <span className="font-display text-sm font-semibold">Resoniq</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">studio</span>
        </Link>
        <div className="flex items-center gap-4 font-mono text-[11px] text-muted">
          <SaveIndicator status={saveStatus} />
          <SpatialToggle />
          <SettingsDrawer className="-my-1" />
          {userName && <span className="hidden sm:inline">{userName}</span>}
          <Clock />
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col pb-[68px]">
        <h1 className="sr-only">Resoniq Studio</h1>
        <DesktopCanvas />
        <Dock />
      </main>
    </div>
  );
}

function SpatialToggle() {
  const spatial = useWindowStore((s) => s.spatial);
  const store = useWindowStoreApi();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={spatial}
      onClick={() => store.getState().setSpatial(!spatial)}
      title="Spatial mode: a 3D scene and depth behind the windows (Alt+Shift+S)"
      className={`focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 uppercase tracking-[0.14em] transition-colors ${
        spatial ? "border-signal/40 text-signal" : "border-white/10 hover:text-ink"
      }`}
    >
      <Box size={11} aria-hidden /> spatial
    </button>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const view = {
    pending: { icon: <Loader2 size={12} className="animate-spin" />, text: "unsaved" },
    saving: { icon: <Loader2 size={12} className="animate-spin" />, text: "saving" },
    saved: { icon: <Check size={12} className="text-signal" />, text: "layout saved" },
    error: { icon: <CloudOff size={12} className="text-danger" />, text: "not saved" },
  }[status];
  return (
    <span role="status" className="flex items-center gap-1.5">
      {view.icon}
      {view.text}
    </span>
  );
}

/** Ticks once a minute; isolated so the rest of the shell never re-renders for it. */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  return <time dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>;
}

function useStudioShortcuts() {
  const store = useWindowStoreApi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const shortcut = SHORTCUTS.find((s) => s.code === e.code);
      if (!shortcut?.action) return;
      e.preventDefault();
      const s = store.getState();
      switch (shortcut.action) {
        case "tile":
          return s.tileWindows();
        case "cascade":
          return s.cascadeWindows();
        case "minimizeAll":
          return s.minimizeAll();
        case "maximize":
          return s.focusedId && s.maximizeWindow(s.focusedId);
        case "close":
          return s.focusedId && s.closeWindow(s.focusedId);
        case "spatial":
          return s.setSpatial(!s.spatial);
        case "cycle": {
          // Bring the bottom-most visible window to the front.
          const visible = Object.values(s.windows).filter((w) => !w.isMinimized);
          if (visible.length < 2) return;
          const bottom = visible.reduce((a, b) => (a.zIndex < b.zIndex ? a : b));
          return s.focusWindow(bottom.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);
}
