import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/auth";
import SessionProvider from "@/components/providers/SessionProvider";

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
  title: { default: "Resoniq: play it, share the rig, steal the tone", template: "%s — Resoniq" },
  description:
    "The community for guitarists and bassists: post performances with the exact rig attached, browse and remix tones, and get starting-point recipes from recordings.",
  metadataBase: new URL(process.env.AUTH_URL ?? "http://localhost:3000"),
  openGraph: { siteName: "Resoniq", images: ["/brand/og-studio.jpg"] },
  icons: { icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "any" }], apple: "/brand/app-icon-180.png" },
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
          <a href="#main" className="focus-ring sr-only z-[100] rounded-full bg-copper px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
            Skip to content
          </a>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
