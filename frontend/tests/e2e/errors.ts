import type { Page } from "@playwright/test";

/**
 * Uncaught page errors, minus one known non-error: WebKit reports Next.js
 * link prefetches (`?_rsc=`) cancelled by a navigation as "… due to access
 * control checks". Chrome cancels the same requests silently.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    if (/_rsc=.*due to access control checks/.test(e.message)) return;
    errors.push(e.message);
  });
  return errors;
}
