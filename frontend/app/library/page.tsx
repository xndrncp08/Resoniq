import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ToneLibraryClient from "@/components/library/ToneLibraryClient";

export default async function LibraryPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/library");

  const tones = await prisma.tone.findMany({
    where: { userId: session.user.id },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="min-h-screen bg-bg px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          library
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your saved tones
        </h1>

        <div className="mt-12">
          <ToneLibraryClient initialTones={JSON.parse(JSON.stringify(tones))} />
        </div>
      </div>
    </main>
  );
}
