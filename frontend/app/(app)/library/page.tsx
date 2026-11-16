import type { Metadata } from "next";
import { loadLibrary } from "@/lib/library";
import ToneLibraryClient from "@/components/library/ToneLibraryClient";
import { requirePageUserId } from "@/lib/session";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Your saved tones" };

export default async function LibraryPage() {
  const userId = await requirePageUserId("/library");

  const recipes = await loadLibrary(userId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Tone vault">Tones you&apos;ve made and saved.</PageHeader>
      <ToneLibraryClient initialTones={recipes} />
    </div>
  );
}
