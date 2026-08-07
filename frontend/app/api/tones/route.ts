import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const tones = await prisma.tone.findMany({
    where: {
      userId: session.user.id,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ tones });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { name, data, songId } = await req.json();
  if (!name || !data) {
    return NextResponse.json(
      { error: "name and data are required." },
      { status: 400 },
    );
  }

  const tone = await prisma.tone.create({
    data: { userId: session.user.id, name, data, songId: songId ?? null },
  });

  return NextResponse.json({ tone }, { status: 201 });
}
