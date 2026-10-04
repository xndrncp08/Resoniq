import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import SessionProvider from "@/components/providers/SessionProvider";
import MotionProvider from "@/components/providers/MotionProvider";
import Nav from "@/components/landing/Nav";
import SceneRoot from "@/components/scene/SceneRoot";

// Self-hosted at build time by next/font: no request to Google at runtime,
// and the CSP can keep font-src to 'self'.
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space-grotesk" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const viewport: Viewport = {
  themeColor: "#0A0D12",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: { default: "Resoniq — Recreate Any Guitar Tone", template: "%s — Resoniq" },
  description:
    "Upload a song and get a starting-point guitar tone recipe — amp, pedals, EQ, and effects — inferred from the recording.",
  icons: { icon: "/logo.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="antialiased selection:bg-copper/30 selection:text-ink">
        <SessionProvider session={session}>
          <MotionProvider>
            <SceneRoot />
            <Nav />
            {children}
          </MotionProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
