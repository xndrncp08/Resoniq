"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createRigStore, type RigSound, type RigState, type RigStore } from "@/lib/stores/rig-store";

const RigContext = createContext<RigStore | null>(null);

/** Scopes one rig to a subtree. React Three Fiber bridges context, so 3D views inside read the same store. */
export function RigStoreProvider({ initial, children }: { initial: RigSound; children: ReactNode }) {
  const [store] = useState(() => createRigStore(initial));
  return <RigContext.Provider value={store}>{children}</RigContext.Provider>;
}

export function useRigStore() {
  const store = useContext(RigContext);
  if (!store) throw new Error("useRig must be used inside <RigStoreProvider>");
  return store;
}

/** Subscribe to one slice; components re-render only when that slice changes. */
export function useRig<T>(selector: (s: RigState) => T) {
  return useStore(useRigStore(), selector);
}
