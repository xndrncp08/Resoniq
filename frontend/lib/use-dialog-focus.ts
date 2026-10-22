"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

/**
 * Focus handling for a modal panel: moves focus in (to `initial`, or the
 * first focusable element), keeps Tab inside, closes on Escape, and gives
 * focus back to whatever opened it.
 */
export function useDialogFocus(panel: RefObject<HTMLElement | null>, onClose: () => void, initial?: RefObject<HTMLElement | null>) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      panel.current ? [...panel.current.querySelectorAll<HTMLElement>("button, a[href], input, textarea, select, [tabindex]")].filter((el) => !el.matches(":disabled, [hidden], [tabindex='-1']") && el.getClientRects().length > 0) : [];
    (initial?.current ?? focusables()[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [panel, initial]);
}
