import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runs against a real Postgres (TEST_DATABASE_URL, must end in _test); see tests/integration/global-setup.ts.
export default defineConfig({
  // next-auth imports "next/server" without an extension, which Node's ESM resolver rejects outside Next.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)), "next/server": "next/server.js" } },
  test: {
    environment: "node",
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    include: ["tests/integration/**/*.int.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "", AUTH_SECRET: "test-secret" },
  },
});
