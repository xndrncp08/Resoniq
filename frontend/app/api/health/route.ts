import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** For uptime monitors: is the app serving, and can it reach its database? */
export async function GET() {
  const start = Date.now();
  const db = await Promise.race([
    prisma.$queryRaw`SELECT 1`.then(() => true, () => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
  ]);
  return NextResponse.json({ status: db ? "ok" : "degraded", db, ms: Date.now() - start }, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
