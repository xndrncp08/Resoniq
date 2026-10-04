"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import Feedback from "@/components/ui/Feedback";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { spring } from "@/lib/motion";

/**
 * Modal for sharing a tone link. Copies to the clipboard when allowed and
 * always shows the URL, so sharing still works when clipboard access is
 * denied. Focus handling comes from useDialogFocus; the backdrop also closes it.
 */
export default function ShareDialog({
  tone,
  onClose,
}: {
  tone: { id: string; title: string } | null;
  onClose: () => void;
}) {
  return <AnimatePresence>{tone && <Dialog key={tone.id} tone={tone} onClose={onClose} />}</AnimatePresence>;
}

function Dialog({ tone, onClose }: { tone: { id: string; title: string }; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const url = `${window.location.origin}/t/${tone.id}`;

  useDialogFocus(panel, onClose, input);
  useEffect(() => {
    input.current?.select();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      // Permissions or an insecure context; the URL is selected for a manual copy.
      setCopy("failed");
      input.current?.select();
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="glass shadow-panel w-full max-w-md rounded-panel bg-bg-elevated/90 p-6"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.15 } }}
        transition={spring.snappy}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="share-title" className="font-display text-lg font-medium">
              Share tone
            </h2>
            <p className="mt-0.5 truncate font-body text-sm text-muted">{tone.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -mr-2 -mt-1 rounded-full p-2 text-muted transition-colors hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <label htmlFor="share-url" className="sr-only">
          Share link
        </label>
        <div className="mt-5 flex gap-2">
          <input
            ref={input}
            id="share-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="focus-ring min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-base text-ink outline-none sm:text-xs"
          />
          <button
            type="button"
            onClick={copyLink}
            className="focus-ring flex items-center gap-1.5 rounded-lg bg-copper px-4 font-body text-sm font-semibold text-bg transition-colors hover:bg-copper/90"
          >
            {copy === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copy === "copied" ? "Copied" : "Copy"}
          </button>
        </div>

        {copy === "copied" && (
          <Feedback tone="success" className="mt-2 font-body text-xs">
            Link copied to your clipboard.
          </Feedback>
        )}
        {copy === "failed" && (
          <Feedback tone="notice" className="mt-2 font-body text-xs">
            Couldn&apos;t reach the clipboard. The link is selected; copy it with ⌘C / Ctrl+C.
          </Feedback>
        )}

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
          <p className="font-body text-xs text-muted">Anyone with this link can view the recipe. Not your audio.</p>
          <a
            href={`/t/${tone.id}`}
            target="_blank"
            rel="noopener"
            className="focus-ring flex flex-shrink-0 items-center gap-1 rounded font-body text-xs text-signal hover:underline"
          >
            Open <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
