"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const links = [
  { label: "Platform", href: "/#ecosystem" },
  { label: "Practice", href: "/practice" },
  { label: "Analysis", href: "/#how-it-works" },
  { label: "Communities", href: "/c" },
  { label: "Tones", href: "/tones" },
];

/** The marketing header: transparent over the hero, a solid bar once you scroll. */
export default function Nav() {
  const { status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const signedIn = status === "authenticated";
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[background,border-color] duration-300 ${scrolled ? "border-b border-line bg-bg/85 backdrop-blur-xl" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg" aria-label="Resoniq home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" width={34} height={34} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark.svg" alt="" width={118} height={24} className="hidden h-[18px] w-auto sm:block" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="focus-ring rounded-full px-3.5 py-2 font-body text-sm text-ink-dim transition-colors hover:text-ink">{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/feed" className="focus-ring rounded-full bg-copper px-5 py-2.5 font-body text-sm font-semibold text-bg hover:bg-copper-soft">Open Resoniq</Link>
          ) : (
            <>
              <Link href="/login" className="focus-ring hidden rounded-full px-4 py-2.5 font-body text-sm text-ink-dim hover:text-ink sm:block">Sign in</Link>
              <Link href="/signup" className="focus-ring rounded-full bg-copper px-5 py-2.5 font-body text-sm font-semibold text-bg hover:bg-copper-soft">Join free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
