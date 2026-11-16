import type { Metadata } from "next";
import { after } from "next/server";
import UploadPanel from "@/components/audio/UploadPanel";
import { storageAvailable } from "@/lib/hosting";
import { getStorage } from "@/lib/storage";
import { requirePageUserId } from "@/lib/session";
import { warmEngine } from "@/lib/engine";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Analyze a song" };

export default async function AnalyzePage() {
  await requirePageUserId("/analyze");
  const storage = storageAvailable();
  const caps = { storage, direct: storage && getStorage().driver === "supabase", engine: !!process.env.PYTHON_ENGINE_URL && !!process.env.RESONIQ_ENGINE_SECRET };
  // After the response: start waking a sleeping engine while the member chooses a file.
  if (caps.engine && caps.storage) after(warmEngine);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Analyze a song">We&apos;ll estimate the guitar tone and build a starting signal chain from it.</PageHeader>
      <div>
        <UploadPanel
          mode={caps.direct ? "direct" : "multipart"}
          unavailable={!caps.storage ? "Song analysis isn't available on this deployment yet: there's nowhere to store uploads. Browse tones and rigs in the meantime." : !caps.engine ? "The analysis engine isn't connected on this deployment yet. Browse tones and rigs in the meantime." : null}
        />
      </div>
    </div>
  );
}