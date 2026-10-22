import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // next-auth imports "next/server" without an extension, which Node's ESM resolver rejects outside Next.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)), "next/server": "next/server.js" } },
  test: {
    environment: "node",
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**"],
    env: { AUTH_SECRET: "test-secret" },
  },
});
