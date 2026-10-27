import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { deviceStorage } from "@/lib/consent";

/**
 * The unsent post on this device, one per account (keyed by user id so two
 * people sharing a browser never see each other's drafts). Text and choices
 * only: uploads belong to the server and aren't kept.
 */
export type Draft = { category: string; community: string; title: string; body: string; toneId: string; savedAt: number };
type Drafts = {
  drafts: Record<string, Draft>;
  save: (userId: string, draft: Omit<Draft, "savedAt">) => void;
  discard: (userId: string) => void;
};

const MAX_ACCOUNTS = 5;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** localStorage is user-editable: keep only well-formed drafts, at real lengths. */
export function sanitizeDrafts(raw: unknown): Record<string, Draft> {
  const out: Record<string, Draft> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, d] of Object.entries(raw as Record<string, Record<string, unknown>>).slice(0, MAX_ACCOUNTS)) {
    if (!d || typeof d !== "object" || !/^[a-z0-9]{10,40}$/i.test(id)) continue;
    const draft = { category: str(d.category, 40), community: str(d.community, 60), title: str(d.title, 200), body: str(d.body, 10_000), toneId: str(d.toneId, 40), savedAt: typeof d.savedAt === "number" && Number.isFinite(d.savedAt) ? d.savedAt : 0 };
    if (draft.title.trim() || draft.body.trim()) out[id] = draft;
  }
  return out;
}

export const useDrafts = create<Drafts>()(
  persist(
    (set) => ({
      drafts: {},
      save: (userId, draft) =>
        set((s) => {
          const { [userId]: _old, ...rest } = s.drafts;
          if (!draft.title.trim() && !draft.body.trim()) return { drafts: rest };
          return { drafts: sanitizeDrafts({ [userId]: { ...draft, savedAt: Date.now() }, ...rest }) };
        }),
      discard: (userId) => set((s) => { const { [userId]: _gone, ...rest } = s.drafts; return { drafts: rest }; }),
    }),
    {
      name: "resoniq:drafts",
      version: 1,
      // Only kept in this browser if the visitor allowed on-device preferences (lib/consent.ts).
      storage: createJSONStorage(() => deviceStorage),
      partialize: ({ drafts }) => ({ drafts }),
      merge: (stored, current) => ({ ...current, drafts: sanitizeDrafts((stored as { drafts?: unknown } | undefined)?.drafts) }),
      skipHydration: true,
    },
  ),
);

/** Loads drafts after hydration (the server never has them) and reports when they're in. */
export function useDraftsReady() {
  useEffect(() => {
    if (!useDrafts.persist.hasHydrated()) void useDrafts.persist.rehydrate();
  }, []);
  return useSyncExternalStore((cb) => useDrafts.persist.onFinishHydration(cb), () => useDrafts.persist.hasHydrated(), () => false);
}
