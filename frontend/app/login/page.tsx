import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <AuthForm mode="login" />
    </main>
  );
}