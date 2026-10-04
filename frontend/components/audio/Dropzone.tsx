"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { UploadCloud } from "lucide-react";
import { spring } from "@/lib/motion";

const ACCEPTED = [".mp3", ".wav", ".flac"];
const MAX_BYTES = 50 * 1024 * 1024;

export default function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError(`"${file.name}" isn't an MP3, WAV, or FLAC file.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is over the 50MB limit.`);
      return;
    }
    setError(null);
    onFile(file);
  }

  return (
    <div>
      {/* A real button, so the picker opens from the keyboard too. */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, scale: dragging ? 1.01 : 1 }}
        transition={spring.snappy}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        aria-describedby="dropzone-hint"
        className={`focus-ring glass flex w-full cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed px-8 py-16 text-center transition-colors ${
          dragging ? "border-copper bg-copper/[0.06]" : "border-white/10 hover:border-white/20"
        }`}
      >
        <UploadCloud size={36} aria-hidden className={`transition-colors ${dragging ? "text-copper" : "text-muted"}`} />
        <span className="mt-4 font-display text-lg font-medium">Drop a song here, or click to browse</span>
        <span id="dropzone-hint" className="mt-1.5 font-mono text-xs text-muted">
          MP3, WAV, or FLAC · up to 50MB · up to 10 minutes
        </span>
      </motion.button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="mt-3 text-center font-body text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
