import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import { ForgotPassword } from "@/components/auth/TokenForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main" className="flex min-h-screen items-center justify-center px-6">
        <ForgotPassword />
      </main>
    </>
  );
}
