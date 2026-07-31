"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

export default function LinkPasteInput() {
  const [url, setUrl] = useState("");

  return (
    <div className="glass rounded-panel border-2 border-dashed border-white/10 px-8 py-16 text-center">
      <Link2 size={36} className="mx-auto text-muted" />
      <p className="mt-4 font-display text-lg font-medium">Paste a song link</p>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="focus-ring mx-auto mt-4 block w-full max-w-sm rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center font-body text-sm outline-none"
      />
      <p className="mx-auto mt-4 max-w-sm font-body text-xs text-muted">
        Link-based analysis (YouTube / Spotify / SoundCloud) isn't wired up yet
        — pulling audio from those platforms directly runs into real licensing
        and terms-of-service limits we're still working through properly. File
        upload above works today.
      </p>
    </div>
  );
}
