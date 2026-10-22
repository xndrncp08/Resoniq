"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { IconButton } from "@/components/app/ui";

function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose);
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        className={`panel max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-b-[22px] sm:p-6 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} size={36} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** A modal (a bottom sheet on phones). Rendered in a portal so cards can open it. */
export default function Dialog({ open, ...props }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (typeof document === "undefined") return null;
  return createPortal(<MotionConfig reducedMotion="user"><AnimatePresence>{open && <Panel {...props} />}</AnimatePresence></MotionConfig>, document.body);
}
