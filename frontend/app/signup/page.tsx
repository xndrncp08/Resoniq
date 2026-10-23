import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import Nav from "@/components/landing/Nav";
import { googleEnabled } from "@/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { signupsOpen } from "@/lib/hosting";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  const signups = await signupsOpen();
  return (
    <>
    <Nav />
    <main id="main" className="flex min-h-screen items-center justify-center px-6">
      {signups.open ? (
        <AuthForm mode="signup" googleEnabled={googleEnabled} callbackUrl={safeCallbackPath(callbackUrl, "/feed")} />
      ) : (
        <div className="panel w-full max-w-md space-y-4 p-8 text-center" role="status">
          <h1 className="font-display text-2xl font-semibold">Not open yet</h1>
          <p className="font-body text-ink-dim">{signups.reason}</p>
          <a href="/login" className="focus-ring inline-flex h-11 items-center rounded-full bg-copper px-6 font-body text-sm font-semibold text-bg">Sign in</a>
        </div>
      )}
    </main>
    </>
  );
}
