"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createWindowStore, type WindowStoreApi } from "@/lib/studio/window-store";
import type { WindowStore, WorkspaceLayout } from "@/lib/studio/types";

/**
 * One window store per mounted Studio, created from the user's saved layout.
 * A module-level Zustand singleton would be shared by every request the
 * server renders, leaking one user's desktop into another's HTML.
 */
const StoreContext = createContext<WindowStoreApi | null>(null);

export function WindowStoreProvider({ initialLayout, children }: { initialLayout: WorkspaceLayout | null; children: ReactNode }) {
  const [store] = useState(() => createWindowStore(initialLayout));
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useWindowStoreApi(): WindowStoreApi {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useWindowStore must be used inside <WindowStoreProvider>.");
  return store;
}

/**
 * Subscribe to a slice of the window store. Select the narrowest slice a
 * component needs (e.g. `s => s.windows[id]`): it re-renders only when that
 * slice's identity changes. Actions are stable and never cause re-renders.
 */
export function useWindowStore<T>(selector: (state: WindowStore) => T): T {
  return useStore(useWindowStoreApi(), selector);
}
