import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ENGINE_URL = process.env.PYTHON_ENGINE_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { songId } = await req.json();
  if (!songId) {
    return NextResponse.json({ error: "songId is required." }, { status: 400 });
  }

  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song || song.userId !== session.user.id) {
    return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }

  await prisma.song.update({ where: { id: song.id }, data: { status: "ANALYZING" } });

  try {
    const res = await fetch(`${ENGINE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_url: song.fileUrl }),
    });

    const data = await res.json();

    if (!res.ok) {
      await prisma.song.update({
        where: { id: song.id },
        data: { status: "FAILED", analysisError: data.detail ?? "Analysis failed." },
      });
      return NextResponse.json({ error: data.detail ?? "Analysis failed." }, { status: 502 });
    }

    const updated = await prisma.song.update({
      where: { id: song.id },
      data: { status: "ANALYZED", analysisData: data, analysisError: null },
    });

    return NextResponse.json({ song: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach the analysis engine.";
    await prisma.song.update({
      where: { id: song.id },
      data: { status: "FAILED", analysisError: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}