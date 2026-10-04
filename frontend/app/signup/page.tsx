import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { googleEnabled } from "@/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <AuthForm mode="signup" googleEnabled={googleEnabled} callbackUrl={safeCallbackPath(callbackUrl, "/analyze")} />
    </main>
  );
}
