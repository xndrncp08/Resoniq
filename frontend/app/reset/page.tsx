import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import { ResetPassword } from "@/components/auth/TokenForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return (
    <>
      <Nav />
      <main id="main" className="flex min-h-screen items-center justify-center px-6">
        <ResetPassword token={typeof token === "string" ? token : ""} />
      </main>
    </>
  );
}
