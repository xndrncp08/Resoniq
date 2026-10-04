"use client";

import { useEffect, type RefObject } from "react";

/**
 * Focus handling for a modal panel: moves focus in (to `initial`, or the
 * first focusable element), keeps Tab inside, closes on Escape, and gives
 * focus back to whatever opened it.
 */
export function useDialogFocus(panel: RefObject<HTMLElement | null>, onClose: () => void, initial?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panel.current ? [...panel.current.querySelectorAll<HTMLElement>("button, a[href], input, select, [tabindex]:not([tabindex='-1'])")] : [];
    (initial?.current ?? focusables()[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
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
      opener?.focus();
    };
  }, [panel, onClose, initial]);
}
