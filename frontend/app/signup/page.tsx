import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import Nav from "@/components/landing/Nav";
import { googleEnabled } from "@/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { passwordSignupsOpen } from "@/lib/hosting";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  const [password, accountsOpen] = await Promise.all([passwordSignupsOpen(), isEnabled("signups")]);
  // Google sign-up needs no email delivery; the password form only shows when addresses can be verified.
  const open = accountsOpen && (googleEnabled || password.open);
  return (
    <>
    <Nav />
    <main id="main" className="flex min-h-screen items-center justify-center px-6">
      {open ? (
        <AuthForm mode="signup" googleEnabled={googleEnabled} passwordForm={password.open} passwordNote={password.reason}
          callbackUrl={safeCallbackPath(callbackUrl, "/feed")} />
      ) : (
        <div className="panel w-full max-w-md space-y-4 p-8 text-center" role="status">
          <h1 className="font-display text-2xl font-semibold">Not open yet</h1>
          <p className="font-body text-ink-dim">{password.reason}</p>
          <a href="/login" className="focus-ring inline-flex h-11 items-center rounded-full bg-copper px-6 font-body text-sm font-semibold text-bg">Sign in</a>
        </div>
      )}
    </main>
    </>
  );
}
