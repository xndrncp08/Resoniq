import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resoniq — Recreate Any Guitar Tone",
  description:
    "Upload your favorite songs and discover the amp, pedals, EQ, and effects behind the sound.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-copper/30 selection:text-ink">
        {children}
      </body>
    </html>
  );
}
