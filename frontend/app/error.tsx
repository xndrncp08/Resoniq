"use client";

import { useEffect } from "react";
import Link from "next/link";
import Feedback from "@/components/ui/Feedback";

/**
 * Error boundary for every route under the root layout. Server errors
 * arrive with a generic message and a digest that matches the server log,
 * so nothing internal is shown here.
 */
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-bg px-6">
      <div className="glass w-full max-w-md rounded-panel p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-danger">signal lost</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">Something went wrong.</h1>
        <Feedback tone="notice" className="mt-2 font-body text-sm">
          This page hit an error. Trying again usually fixes it.
          {error.digest && <span className="mt-2 block font-mono text-[11px]">ref {error.digest}</span>}
        </Feedback>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="focus-ring rounded-full bg-copper px-5 py-2.5 font-body text-sm font-semibold text-bg transition-colors hover:bg-copper/90"
          >
            Try again
          </button>
          <Link href="/" className="focus-ring glass rounded-full px-5 py-2.5 font-body text-sm transition-colors hover:bg-white/[0.08]">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
