import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function SongStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=/analyze/${id}`);

  const song = await prisma.song.findUnique({ where: { id } });
  if (!song || song.userId !== session.user.id) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="glass max-w-md rounded-panel p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          {song.status.toLowerCase()}
        </p>
        <h1 className="mt-3 font-display text-xl font-medium">
          {song.title ?? "Untitled upload"}
        </h1>
        <p className="mt-4 font-body text-sm text-muted">
          Upload received. The tone-analysis engine and results dashboard
          land in the next build phase — this page just confirms the file
          made it in safely.
        </p>
      </div>
    </main>
  );
}