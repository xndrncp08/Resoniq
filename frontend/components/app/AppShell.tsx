import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/authz";
import { isStaff } from "@/lib/permissions";
import { MobileNav, SideNav, type NavUser } from "@/components/app/AppNav";
import AnnouncementBar from "@/components/app/AnnouncementBar";
import QueryProvider from "@/components/providers/QueryProvider";

/** The signed-in (and public-browsing) app frame: navigation, announcements, content. */
export default async function AppShell({ children }: { children: ReactNode }) {
  const actor = await getActor();
  const viewer = actor && actor.status !== "BANNED" ? actor : null;
  const [user, unread] = viewer
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: viewer.id }, select: { handle: true, name: true, image: true } }),
        prisma.notification.count({ where: { userId: viewer.id, readAt: null } }),
      ])
    : [null, 0];
  const navUser: NavUser = user && viewer ? { ...user, id: viewer.id, isStaff: isStaff(viewer.role) } : null;
  return (
    <QueryProvider key={viewer?.id ?? "guest"}>
    <div className="flex min-h-dvh">
      <SideNav user={navUser} unread={unread} />
      <div className="min-w-0 flex-1">
        <MobileNav user={navUser} unread={unread} />
        <AnnouncementBar />
        <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 sm:px-6 md:pb-12 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
    </QueryProvider>
  );
}
