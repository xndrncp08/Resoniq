import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import SessionProvider from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Resoniq — Recreate Any Guitar Tone",
  description:
    "Upload your favorite songs and discover the amp, pedals, EQ, and effects behind the sound.",
  icons: { icon: "/logo.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-copper/30 selection:text-ink">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
