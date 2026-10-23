import type { Metadata } from "next";
import UploadPanel from "@/components/audio/UploadPanel";
import { storageAvailable } from "@/lib/hosting";
import { getStorage } from "@/lib/storage";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Analyze a song" };

export default async function AnalyzePage() {
  await requirePageUserId("/analyze");
  const storage = storageAvailable();
  const caps = { storage, direct: storage && getStorage().driver === "supabase", engine: !!process.env.PYTHON_ENGINE_URL && !!process.env.RESONIQ_ENGINE_SECRET };

  return (
    <div className="py-2">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">analyze</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Upload a song
        </h1>
        <p className="mt-3 font-body text-sm text-muted">
          We&apos;ll pull out the guitar tone and build a signal chain from it.
        </p>
      </div>

      <div className="mt-14">
        <UploadPanel
          mode={caps.direct ? "direct" : "multipart"}
          unavailable={!caps.storage ? "Song analysis isn't available on this deployment yet: there's nowhere to store uploads. Browse tones and rigs in the meantime." : !caps.engine ? "The analysis engine isn't connected on this deployment yet. Browse tones and rigs in the meantime." : null}
        />
      </div>
    </div>
  );
}