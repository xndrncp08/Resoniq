import { expect, test, type Page } from "@playwright/test";

export const PASSWORD = "E2e-Riff-Pass-2026!";

/** (Local runs: sign-ups are rate limited to 5 per 15 minutes per IP, in memory, so restart the server between larger batches.)
 * A fresh member, signed in through the auth endpoints (the page shares the cookie), optional storage refused. Skips where sign-ups are off. */
export async function signUp(page: Page, prefix: string) {
  const email = `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@resoniq.test`;
  const res = await page.request.post("/api/register", { data: { email, password: PASSWORD, name: `E2E ${prefix}` } });
  test.skip(!res.ok(), `Sign-ups unavailable here (${res.status()})`);
  const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
  await page.request.post("/api/auth/callback/credentials", { form: { csrfToken, email, password: PASSWORD, callbackUrl: "/" } });
  expect((await (await page.request.get("/api/auth/session")).json())?.user?.email).toBe(email);
  const url = new URL(test.info().project.use.baseURL ?? "http://localhost:3100");
  await page.context().addCookies([{ name: "resoniq_consent", value: `1.p0.a0.${Math.floor(Date.now() / 1000)}`, domain: url.hostname, path: "/" }]);
}

export async function deleteAccount(page: Page) {
  const me = await page.request.get("/api/me");
  if (!me.ok()) return;
  const { profile } = await me.json();
  await page.request.delete("/api/me", { data: { confirmHandle: profile.handle, password: PASSWORD } });
}
