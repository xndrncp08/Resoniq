import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import { ForgotPassword } from "@/components/auth/TokenForms";
import { mailConfigured } from "@/lib/mailer";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main" className="flex min-h-screen items-center justify-center px-6">
        {mailConfigured() ? (
          <ForgotPassword />
        ) : (
          <div className="panel w-full max-w-md space-y-4 p-8 text-center" role="status">
            <h1 className="font-display text-2xl font-semibold">Password reset isn&apos;t available</h1>
            <p className="font-body text-ink-dim">Resoniq can&apos;t send email yet, so passwords can&apos;t be reset by link. If you joined with Google, sign in with Google.</p>
            <a href="/login" className="focus-ring inline-flex h-11 items-center rounded-full bg-copper px-6 font-body text-sm font-semibold text-bg">Back to sign in</a>
          </div>
        )}
      </main>
    </>
  );
}
