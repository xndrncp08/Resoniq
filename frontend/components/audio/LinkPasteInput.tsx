import { Link2 } from "lucide-react";

/**
 * Placeholder for link-based analysis. Deliberately not wired up: pulling
 * audio from YouTube / Spotify / SoundCloud runs into their terms of service
 * and licensing, so the input is disabled rather than pretending to work.
 */
export default function LinkPasteInput() {
  return (
    <div className="glass rounded-panel border-2 border-dashed border-white/10 px-8 py-16 text-center">
      <Link2 size={36} className="mx-auto text-muted" aria-hidden />
      <p className="mt-4 font-display text-lg font-medium">Paste a song link</p>
      <input
        type="url"
        disabled
        aria-describedby="link-unavailable"
        placeholder="Not available yet"
        className="mx-auto mt-4 block w-full max-w-sm cursor-not-allowed rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center font-body text-base text-muted outline-none sm:text-sm"
      />
      <p id="link-unavailable" className="mx-auto mt-4 max-w-sm text-pretty font-body text-xs text-muted">
        Link-based analysis (YouTube / Spotify / SoundCloud) isn&apos;t available — pulling audio from those
        platforms runs into real licensing and terms-of-service limits. File upload works today.
      </p>
    </div>
  );
}
