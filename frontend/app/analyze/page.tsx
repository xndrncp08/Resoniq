import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UploadPanel from "@/components/audio/UploadPanel";

export default async function AnalyzePage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/analyze");

  return (
    <main className="min-h-screen bg-bg px-6 py-32">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">analyze</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Upload a song
        </h1>
        <p className="mt-3 font-body text-sm text-muted">
          We'll pull out the guitar tone and build a signal chain from it.
        </p>
      </div>

      <div className="mt-14">
        <UploadPanel />
      </div>
    </main>
  );
}