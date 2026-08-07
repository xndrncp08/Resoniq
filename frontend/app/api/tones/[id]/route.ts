import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function assertOwnership(id: string, userId: string) {
  const tone = await prisma.tone.findUnique({ where: { id } });
  if (!tone || tone.userId !== userId) return null;
  return tone;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await assertOwnership(id, session.user.id);
  if (!existing)
    return NextResponse.json({ error: "Tone not found." }, { status: 404 });

  const { name, favorite } = await req.json();

  const tone = await prisma.tone.update({
    where: { id },
    data: {
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof favorite === "boolean" ? { favorite } : {}),
    },
  });

  return NextResponse.json({ tone });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await assertOwnership(id, session.user.id);
  if (!existing)
    return NextResponse.json({ error: "Tone not found." }, { status: 404 });

  await prisma.tone.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
