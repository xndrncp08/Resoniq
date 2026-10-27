"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@/components/app/Dialog";
import { Button } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";

/**
 * One place that protects unsaved work across Resoniq. Forms register what's
 * dirty (and, if they can, how to save it) with useUnsavedChanges. While
 * anything is dirty:
 *   - closing or reloading the tab gets the browser's own warning;
 *   - following an in-app link asks first: Save changes, Discard changes or Keep editing;
 *   - in-page actions that would throw work away (switching presets, closing
 *     a dialog) can ask the same question with `confirmLeave()`.
 * Nothing asks when there's nothing to lose.
 */

type Guard = { dirty: boolean; label: string; save?: () => Promise<unknown> };
type Ctx = { set: (id: string, g: Guard) => void; remove: (id: string) => void; confirm: () => Promise<boolean> };
const UnsavedContext = createContext<Ctx | null>(null);

/** A same-origin link the router would handle, that leads somewhere else. */
function internalHref(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null; // same page, or a #hash
  return url.pathname + url.search + url.hash;
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const guards = useRef(new Map<string, Guard>());
  const [ask, setAsk] = useState<{ resolve: (go: boolean) => void; guards: Guard[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = () => [...guards.current.values()].filter((g) => g.dirty);

  const confirm = useCallback(() => {
    const pending = dirty();
    if (!pending.length) return Promise.resolve(true);
    setError(null);
    return new Promise<boolean>((resolve) => setAsk({ resolve, guards: pending }));
  }, []);

  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty().length) e.preventDefault();
    };
    // Capture phase: decide before Next's <Link> starts the navigation.
    const click = (e: MouseEvent) => {
      if (!dirty().length) return;
      const href = internalHref(e);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      void confirm().then((go) => go && router.push(href));
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [confirm, router]);

  const close = (go: boolean) => {
    ask?.resolve(go);
    setAsk(null);
  };
  async function saveAll() {
    if (!ask) return;
    setSaving(true);
    setError(null);
    try {
      for (const g of ask.guards) await g.save!();
      close(true);
    } catch (err) {
      // Stay put: the work is still on the page, and the dirty state is untouched.
      setError(`${errorMessage(err)} Nothing was lost; try again or keep editing.`);
    } finally {
      setSaving(false);
    }
  }

  const value = useMemo<Ctx>(() => ({ set: (id, g) => guards.current.set(id, g), remove: (id) => guards.current.delete(id), confirm }), [confirm]);
  const canSave = !!ask && ask.guards.every((g) => g.save);
  const what = ask ? [...new Set(ask.guards.map((g) => g.label))].join(", ") : "";

  return (
    <UnsavedContext.Provider value={value}>
      {children}
      <Dialog open={!!ask} title="Unsaved changes" onClose={() => !saving && close(false)}>
        <p className="font-body text-[15px] leading-relaxed text-ink-dim">
          You have unsaved changes to <span className="text-ink">{what}</span>. {canSave ? "Save them before you go?" : "Leaving will discard them."}
        </p>
        {error && <p role="alert" className="mt-3 font-body text-sm text-danger">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => close(false)} disabled={saving} autoFocus>Keep editing</Button>
          <Button variant="ghost" className="text-danger" onClick={() => close(true)} disabled={saving}>Discard changes</Button>
          {canSave && <Button variant="primary" onClick={saveAll} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>}
        </div>
      </Dialog>
    </UnsavedContext.Provider>
  );
}

/**
 * Registers a form's unsaved state. `save` (optional) lets the leave prompt
 * offer "Save changes"; it should throw on failure so nothing is discarded.
 * Returns `confirmLeave()`: resolves true when it's fine to throw the work away.
 */
export function useUnsavedChanges({ dirty, label, save }: { dirty: boolean; label: string; save?: () => Promise<unknown> }) {
  const ctx = useContext(UnsavedContext);
  const id = useId();
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => {
    ctx?.set(id, { dirty, label, save: save ? () => latest.current!() : undefined });
    // `save` identity changes every render; only whether one exists matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, id, dirty, label, !!save]);
  useEffect(() => () => ctx?.remove(id), [ctx, id]);
  return { confirmLeave: ctx?.confirm ?? (() => Promise.resolve(true)) };
}

/** For actions that would replace unsaved work (switching presets): asks only if something is dirty. */
export function useConfirmLeave() {
  return useContext(UnsavedContext)?.confirm ?? (() => Promise.resolve(true));
}

export type SaveState = "saved" | "saving" | "unsaved" | "failed" | "idle";

/** The one save indicator: saved, saving, unsaved or failed (with the reason). */
export function SaveStatus({ state, error, className = "" }: { state: SaveState; error?: string | null; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={`font-body text-sm ${className}`}>
      {state === "saving" ? <span className="text-muted">Saving…</span>
        : state === "failed" ? <span className="text-danger">{error ? `Couldn't save: ${error}` : "Couldn't save."} Your changes are still here.</span>
        : state === "unsaved" ? <span className="inline-flex items-center gap-1.5 text-amber"><span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />Unsaved changes</span>
        : state === "saved" ? <span className="text-signal">All changes saved.</span>
        : null}
    </p>
  );
}

/** Save state from a mutation and a dirty flag. */
export const saveState = (m: { isPending: boolean; isError: boolean; isSuccess: boolean }, dirty: boolean): SaveState =>
  m.isPending ? "saving" : m.isError ? "failed" : dirty ? "unsaved" : m.isSuccess ? "saved" : "idle";
