import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/auth";
import SessionProvider from "@/components/providers/SessionProvider";
import MotionProvider from "@/components/providers/MotionProvider";
import Nav from "@/components/landing/Nav";

// Bundled fonts keep builds offline and font-src limited to 'self'.
const display = localFont({ src: "../public/fonts/space-grotesk-latin.woff2", weight: "500 700", variable: "--font-space-grotesk", display: "swap" });
const body = localFont({ src: "../public/fonts/inter-latin.woff2", weight: "400 600", variable: "--font-inter", display: "swap" });
const mono = localFont({
  src: [
    { path: "../public/fonts/ibm-plex-mono-latin-400.woff2", weight: "400" },
    { path: "../public/fonts/ibm-plex-mono-latin-500.woff2", weight: "500" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

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
            <Nav />
            {children}
          </MotionProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
