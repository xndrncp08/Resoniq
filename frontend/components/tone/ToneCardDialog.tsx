"use client";

import { useState } from "react";
import Dialog from "@/components/app/Dialog";
import Icon from "@/components/icons/Icon";
import { Button, buttonClass } from "@/components/app/ui";

const FORMATS = [["square", "Square", "Feeds"], ["story", "Story", "9:16"], ["wide", "Wide", "Links"]] as const;

/** A downloadable image of the tone's settings, for posting anywhere. Private tones need a link first. */
export default function ToneCardDialog({ id, name, visibility, open, onClose }: { id: string; name: string; visibility: string; open: boolean; onClose: () => void }) {
  const [format, setFormat] = useState<(typeof FORMATS)[number][0]>("square");
  const [msg, setMsg] = useState<string | null>(null);
  const src = `/api/og/card/${id}?format=${format}`;
  async function share() {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `${name}-${format}.png`, { type: "image/png" });
      const data = { files: [file], title: name, url: `${location.origin}/t/${id}` };
      if (navigator.canShare?.(data)) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${location.origin}/t/${id}`);
        setMsg("This browser can't share images directly; the link is copied. Download the card to post it.");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setMsg("Couldn't share the card. Download it instead.");
    }
  }
  return (
    <Dialog open={open} title="Tone card" onClose={onClose} wide>
      {visibility === "PRIVATE" ? (
        <p className="font-body text-sm text-muted">Cards show the tone&apos;s settings to anyone who sees them, so they&apos;re for unlisted or public tones. Change the visibility below the tone&apos;s actions, then come back.</p>
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-1.5">
            {FORMATS.map(([v, label, hint]) => (
              <button key={v} type="button" role="radio" aria-checked={format === v} onClick={() => setFormat(v)} className={`focus-ring h-9 rounded-full border px-4 font-body text-sm ${format === v ? "border-copper/60 bg-copper/10 text-ink" : "border-line text-muted hover:text-ink"}`}>{label} <span className="text-muted">· {hint}</span></button>
            ))}
          </div>
          <div className="flex justify-center rounded-xl border border-line bg-bg-0 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, already the right size */}
            <img key={src} src={src} alt={`Tone card for ${name}: amp settings, signal chain and Tone DNA`} className={`h-auto rounded-lg ${format === "story" ? "max-h-[60vh] w-auto" : "w-full"}`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`${src}&download=1`} download className={buttonClass("primary", "md")}><Icon name="download" size={18} /> Download PNG</a>
            <Button icon="share" onClick={share}>Share</Button>
          </div>
          {msg && <p role="status" className="font-body text-sm text-muted">{msg}</p>}
          <p className="font-body text-xs text-muted">Shows the real settings and where they came from (studio, declared rig or analysis estimate), with a link back to the tone.</p>
        </div>
      )}
    </Dialog>
  );
}
