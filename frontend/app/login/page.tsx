import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import Nav from "@/components/landing/Nav";
import { googleEnabled } from "@/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const { callbackUrl, error } = await searchParams;
  return (
    <>
    <Nav />
    <main id="main" className="flex min-h-screen items-center justify-center px-6">
      <AuthForm mode="login" googleEnabled={googleEnabled} callbackUrl={safeCallbackPath(callbackUrl, "/feed")}
        initialError={typeof error === "string" ? error : undefined}
      />
    </main>
    </>
  );
}
