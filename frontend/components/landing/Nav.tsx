"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";

const links = ["Product", "How it works", "Tones", "Free access"];

export default function Nav() {
  const { data: session, status } = useSession();

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 z-50 w-full"
    >
      <div className="glass mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-panel px-6 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="Resoniq"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            Resoniq
          </span>
        </div>

        <nav className="hidden gap-8 font-body text-sm text-muted md:flex">
          {links.map((l) => (
            <a
              key={l}
              href="#"
              className="focus-ring transition hover:text-ink"
            >
              {l}
            </a>
          ))}
        </nav>

        {status === "authenticated" ? (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="focus-ring rounded-full bg-copper px-5 py-2 font-body text-sm font-medium text-bg transition hover:bg-copper/90"
          >
            {session.user?.name?.split(" ")[0] ?? "Account"} · Sign out
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/signup"
              className="focus-ring shadow-glow rounded-full bg-copper px-8 py-3.5 font-body text-sm font-semibold text-bg transition hover:scale-[1.03]"
            >
              Analyze A Song — Free
            </Link>

            <a
              href="#example-tone"
              className="focus-ring glass rounded-full px-8 py-3.5 font-body text-sm font-medium text-ink transition hover:bg-white/[0.08]"
            >
              Explore Tones
            </a>
          </div>
        )}
      </div>
    </motion.header>
  );
}
