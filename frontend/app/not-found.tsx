import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <div className="text-center">
        <p className="animated fadeIn font-mono text-xs uppercase tracking-[0.2em] text-signal">404 · no signal</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Nothing on this channel.</h1>
        <p className="mt-2 font-body text-sm text-muted">The page or tone you&apos;re after doesn&apos;t exist, or was deleted.</p>
        <Link
          href="/"
          className="focus-ring mt-8 inline-block rounded-full bg-copper px-6 py-2.5 font-body text-sm font-semibold text-bg transition-colors hover:bg-copper/90"
        >
          Back to Resoniq
        </Link>
      </div>
    </main>
  );
}
