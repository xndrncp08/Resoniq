"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";

const ACCEPTED = [".mp3", ".wav", ".flac"];

export default function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const isAccepted = ACCEPTED.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );
    if (!isAccepted) return;
    onFile(file);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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
      className={`glass flex cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed px-8 py-16 text-center transition ${
        dragging ? "border-copper bg-copper/[0.06]" : "border-white/10"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <UploadCloud
        size={36}
        className={dragging ? "text-copper" : "text-muted"}
      />
      <p className="mt-4 font-display text-lg font-medium">
        Drop a song here, or click to browse
      </p>
      <p className="mt-1.5 font-mono text-xs text-muted">
        MP3, WAV, or FLAC · up to 50MB
      </p>
    </motion.div>
  );
}
