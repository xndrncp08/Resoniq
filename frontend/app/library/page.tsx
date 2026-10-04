import type { Metadata } from "next";
import { loadLibrary } from "@/lib/library";
import ToneLibraryClient from "@/components/library/ToneLibraryClient";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Your saved tones" };

export default async function LibraryPage() {
  const userId = await requirePageUserId("/library");

  const recipes = await loadLibrary(userId);

  return (
    <main className="min-h-screen px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">library</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your saved tones</h1>

        <div className="mt-12">
          <ToneLibraryClient initialTones={recipes} />
        </div>
      </div>
    </main>
  );
}
