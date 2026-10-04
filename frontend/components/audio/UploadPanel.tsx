"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Dropzone from "@/components/audio/Dropzone";
import LinkPasteInput from "@/components/audio/LinkPasteInput";
import WaveformPlayer from "@/components/ui/waveform-player";
import Feedback from "@/components/ui/Feedback";
import { spring } from "@/lib/motion";

type Stage = "idle" | "preview" | "uploading" | "finishing" | "error";

type UploadResult = { ok: boolean; body: { error?: string; analysisJobId?: string } };

/**
 * POSTs the form with XMLHttpRequest, which (unlike fetch) reports upload
 * progress, so the bar shows bytes actually sent rather than a guess.
 */
function uploadWithProgress(body: FormData, onProgress: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: xhr.response ?? {} });
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Duration is optional metadata, so this never blocks the upload: browsers
 * may never fire loadedmetadata (a codec they can't probe, or media loading
 * deferred in a background tab), hence the timeout.
 */
function readDuration(file: File, timeoutMs = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

export default function UploadPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "link">("file");
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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

    try {
      const res = await uploadWithProgress(body, setProgress);
      if (!res.ok) {
        setError(res.body.error ?? "Upload failed.");
        setAttempt((n) => n + 1);
        setStage("error");
        return;
      }
      // Bytes are in; the server is storing the file and creating the job.
      setStage("finishing");
      router.push(`/analyze/${res.body.analysisJobId}`);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setAttempt((n) => n + 1);
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

        {tab === "file" && stage !== "idle" && file && (
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
              <WaveformPlayer src={file} />
            </div>

            {(stage === "uploading" || stage === "finishing") && (
              <div className="mt-5">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-white/5"
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  {/* scaleX, not width: a compositor-only animation, no layout per frame */}
                  <motion.div
                    animate={{ scaleX: progress / 100 }}
                    transition={spring.snappy}
                    className="h-full origin-left rounded-full bg-copper shadow-[0_0_10px_var(--color-copper)]"
                  />
                </div>
                <p className="mt-2 font-mono text-[11px] tabular-nums text-muted" aria-live="polite">
                  {stage === "finishing" ? "Uploaded. Starting analysis…" : `Uploading… ${Math.min(100, Math.round(progress))}%`}
                </p>
              </div>
            )}

            {error && (
              <Feedback tone="error" trigger={attempt} className="mt-4 font-body text-sm">
                {error}
              </Feedback>
            )}

            {(stage === "preview" || stage === "error") && (
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