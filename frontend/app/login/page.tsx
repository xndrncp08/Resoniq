import AuthForm from "@/components/auth/AuthForm";
import { googleEnabled } from "@/auth";
import { safeCallbackPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <AuthForm mode="login" googleEnabled={googleEnabled} callbackUrl={safeCallbackPath(callbackUrl, "/analyze")} />
    </main>
  );
}
