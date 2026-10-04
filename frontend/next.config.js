/** Static security headers for every response. The CSP is per-request (nonce) and lives in proxy.ts. */
const securityHeaders = [
  // Browsers only honor HSTS over HTTPS, so this is inert on http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Legacy equivalent of the CSP's frame-ancestors 'none', for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Dockerfile's runner stage copies .next/standalone.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
module.exports = nextConfig;
