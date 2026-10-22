import { execFileSync } from "node:child_process";

/** Applies pending migrations to the test database once per run (tests truncate between cases). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  // Guard: tests truncate every table, so this must never point at a real database.
  if (!url || !new URL(url).pathname.endsWith("_test")) {
    throw new Error("Set TEST_DATABASE_URL to a database whose name ends in _test.");
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
