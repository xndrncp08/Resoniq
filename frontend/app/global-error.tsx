"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces
 * the whole document, so global CSS and fonts aren't available: styles are
 * inline and use the brand's raw values.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0D12", color: "#F3EFE8", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong — Resoniq</title>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#FF5D5D" }}>signal lost</p>
          <h1 style={{ margin: "12px 0 8px", fontSize: 24 }}>Something went wrong.</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#8B93A1" }}>
            Resoniq hit an error loading this page.
            {error.digest && <span style={{ display: "block", marginTop: 8, fontFamily: "monospace", fontSize: 11 }}>ref {error.digest}</span>}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, padding: "10px 20px", border: 0, borderRadius: 999, background: "#FF8A3D", color: "#0A0D12", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
