import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request nonce Content Security Policy for pages (see the Next.js CSP
 * guide). Next reads the nonce back out of the request header and stamps
 * it on its own scripts, so only those run: no inline or third-party
 * script is allowed. Every page here is already dynamically rendered (the
 * root layout reads the session), which nonces require.
 *
 * style-src keeps 'unsafe-inline': Framer Motion server-renders inline
 * style attributes, which nonces can't cover. Injected CSS is far less
 * dangerous than injected script, and script-src stays strict.
 *
 * The other security headers are static and set in next.config.js.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // React needs eval in development only, for its debugging stack traces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // blob: for the upload preview (the waveform player loads a local File).
    "media-src 'self' blob:",
    "connect-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes return JSON/audio, and static assets need no CSP.
      source: "/((?!api|_next/static|_next/image|favicon.ico|logo.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
