/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Dockerfile's runner stage copies .next/standalone.
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};
module.exports = nextConfig;
