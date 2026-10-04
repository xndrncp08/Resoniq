import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requirePageUserId } from "@/lib/session";
import { LayoutError, parseWorkspaceLayout } from "@/lib/studio/layout-validation";
import StudioShell from "@/components/studio/StudioShell";

export const metadata: Metadata = { title: "Studio" };

/**
 * The multi-window workspace. The saved layout is read here, on the server,
 * so the first paint is already the user's desktop rather than a flash of an
 * empty one.
 */
export default async function StudioPage() {
  const userId = await requirePageUserId("/studio");
  const [row, session] = await Promise.all([
    prisma.userWorkspace.findUnique({ where: { userId }, select: { layout: true } }),
    auth(),
  ]);

  let layout = null;
  if (row) {
    try {
      layout = parseWorkspaceLayout(row.layout);
    } catch (err) {
      // A layout saved by an older version that no longer validates: start fresh rather than fail the page.
      if (!(err instanceof LayoutError)) throw err;
      console.warn(`[studio] discarding invalid saved layout for ${userId}: ${err.message}`);
    }
  }

  return <StudioShell initialLayout={layout} userName={session?.user?.name?.split(" ")[0] ?? null} />;
}
