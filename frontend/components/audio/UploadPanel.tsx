"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Dropzone from "@/components/audio/Dropzone";
import LinkPasteInput from "@/components/audio/LinkPasteInput";
import WaveformPreview from "@/components/audio/WaveformPreview";

type Stage = "idle" | "preview" | "uploading" | "error";

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve(null);
    audio.src = URL.createObjectURL(file);
  });
}

export default function UploadPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "link">("file");
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(selected: File) {
    setFile(selected);
    setStage("preview");
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setStage("uploading");
    setProgress(0);
    setError(null);

    const durationSec = await readDuration(file);

    const body = new FormData();
    body.append("file", file);
    if (durationSec) body.append("durationSec", String(durationSec));

    // Simulated smooth progress while the real request is in flight —
    // fetch doesn't expose upload progress without XHR, so this keeps
    // the bar honest-looking without overclaiming precision.
    const tick = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.random() * 12 : p));
    }, 250);

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      clearInterval(tick);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setStage("error");
        return;
      }

      setProgress(100);
      router.push(`/analyze/${data.song.id}`);
    } catch {
      clearInterval(tick);
      setError("Something went wrong. Check your connection and try again.");
      setStage("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex justify-center gap-2">
        {(["file", "link"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setStage("idle");
              setFile(null);
            }}
            className={`focus-ring rounded-full px-5 py-2 font-body text-sm font-medium transition ${
              tab === t ? "bg-copper text-bg" : "glass text-muted hover:text-ink"
            }`}
          >
            {t === "file" ? "Upload a file" : "Paste a link"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "link" && (
          <motion.div key="link" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LinkPasteInput />
          </motion.div>
        )}

        {tab === "file" && stage === "idle" && (
          <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Dropzone onFile={handleFile} />
          </motion.div>
        )}

        {tab === "file" && (stage === "preview" || stage === "uploading" || stage === "error") && file && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass rounded-panel p-6"
          >
            <div className="flex items-center justify-between font-body text-sm">
              <span className="truncate">{file.name}</span>
              <span className="ml-4 flex-shrink-0 font-mono text-xs text-muted">
                {formatBytes(file.size)}
              </span>
            </div>

            <div className="mt-4">
              <WaveformPreview file={file} />
            </div>

            {stage === "uploading" && (
              <div className="mt-5">
                <div className="h-1.5 rounded-full bg-white/5">
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut" }}
                    className="h-full rounded-full bg-copper"
                  />
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted">
                  Uploading… {Math.min(100, Math.round(progress))}%
                </p>
              </div>
            )}

            {error && <p className="mt-4 font-body text-sm text-danger">{error}</p>}

            {stage !== "uploading" && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setFile(null);
                    setStage("idle");
                  }}
                  className="focus-ring glass flex-1 rounded-full py-3 font-body text-sm font-medium transition hover:bg-white/[0.08]"
                >
                  Choose a different file
                </button>
                <button
                  onClick={handleUpload}
                  className="focus-ring shadow-glow flex-1 rounded-full bg-copper py-3 font-body text-sm font-semibold text-bg transition hover:bg-copper/90"
                >
                  Analyze this song
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}