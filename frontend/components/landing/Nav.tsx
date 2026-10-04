"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useSession, signOut } from "next-auth/react";
import { spring } from "@/lib/motion";
import SettingsDrawer from "@/components/settings/SettingsDrawer";
import { transitionTypesFor } from "@/lib/route-depth";

// Absolute so they work from any page, not just the landing page.
const publicLinks = [
  { label: "Product", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Example", href: "/#example-tone" },
  { label: "Free access", href: "/#free-access" },
];

const appLinks = [
  { label: "Analyze", href: "/analyze" },
  { label: "Library", href: "/library" },
  { label: "Studio", href: "/studio" },
];

export default function Nav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const signedIn = status === "authenticated";
  const links = signedIn ? appLinks : publicLinks;

  // The Studio is a full-screen desktop with its own status bar and dock.
  if (pathname.startsWith("/studio")) return null;

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring.enter}
      className="fixed top-0 z-50 w-full px-4"
      // Named so route transitions leave it in place (see globals.css).
      style={{ viewTransitionName: "site-header" }}
    >
      <div className="glass mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded-panel px-4 py-2.5 sm:px-6">
        <Link href="/" transitionTypes={transitionTypesFor(pathname, "/")} className="focus-ring flex items-center gap-2 rounded-lg" aria-label="Resoniq home">
          <Image src="/logo.svg" alt="" width={28} height={28} className="rounded-lg" />
          <span className={`font-display text-lg font-semibold tracking-tight ${signedIn ? "hidden sm:inline" : ""}`}>
            Resoniq
          </span>
        </Link>

        {/* Two app links fit on a phone; the four landing anchors don't. */}
        <nav aria-label="Main" className={`items-center gap-1 font-body text-sm ${signedIn ? "flex" : "hidden md:flex"}`}>
          {links.map((l) => {
            const active = signedIn && (pathname === l.href || pathname.startsWith(`${l.href}/`));
            return (
              <Link
                key={l.href}
                href={l.href}
                transitionTypes={transitionTypesFor(pathname, l.href)}
                aria-current={active ? "page" : undefined}
                className={`focus-ring relative rounded-full px-3 py-1.5 transition-colors ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={spring.snappy}
                    className="absolute inset-0 -z-10 rounded-full bg-white/[0.06]"
                  />
                )}
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <SettingsDrawer />
          {signedIn ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="focus-ring rounded-full border border-white/10 px-4 py-2 font-body text-sm text-muted transition-colors hover:text-ink"
            >
              <span className="hidden sm:inline">{session.user?.name?.split(" ")[0] ?? "Account"} · </span>Sign out
            </button>
          ) : (
            <Link
              href="/analyze"
              transitionTypes={transitionTypesFor(pathname, "/analyze")}
              className="focus-ring rounded-full bg-copper px-4 py-2 font-body text-sm font-medium text-bg transition-colors hover:bg-copper/90 sm:px-5"
            >
              Analyze a song<span className="hidden sm:inline"> — free</span>
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  );
}
