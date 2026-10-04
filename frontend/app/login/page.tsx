import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { googleEnabled } from "@/auth";
import RouteStage from "@/components/motion/RouteStage";
import { safeCallbackPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <RouteStage>
      <main className="flex min-h-screen items-center justify-center px-6">
        <AuthForm mode="login" googleEnabled={googleEnabled} callbackUrl={safeCallbackPath(callbackUrl, "/analyze")} />
      </main>
    </RouteStage>
  );
}
