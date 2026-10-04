import type { Metadata } from "next";
import UploadPanel from "@/components/audio/UploadPanel";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Analyze a song" };

export default async function AnalyzePage() {
  await requirePageUserId("/analyze");

  return (
    <main className="min-h-screen px-6 py-32">
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
        <UploadPanel />
      </div>
    </main>
  );
}