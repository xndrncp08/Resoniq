import { expect, test, type Page } from "@playwright/test";

/** Gig Mode end to end: build a setlist, save it, step through it on stage, delete it. Needs sign-ups enabled. */
const email = `e2e-gig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@resoniq.test`;
const password = "E2e-Riff-Pass-2026!";

async function signUp(page: Page) {
  const res = await page.request.post("/api/register", { data: { email, password, name: "E2E Gigger" } });
  test.skip(!res.ok(), `Sign-ups unavailable here (${res.status()})`);
  // Sign in through the auth endpoints (the browser context shares the cookie).
  const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
  await page.request.post("/api/auth/callback/credentials", { form: { csrfToken, email, password, callbackUrl: "/gigs" } });
  const session = await (await page.request.get("/api/auth/session")).json();
  expect(session?.user?.email).toBe(email);
  // Optional storage refused, as a fresh visitor who said no (the banner isn't what this tests).
  const url = new URL(page.url() === "about:blank" ? (test.info().project.use.baseURL ?? "http://localhost:3100") : page.url());
  await page.context().addCookies([{ name: "resoniq_consent", value: `1.p0.a0.${Math.floor(Date.now() / 1000)}`, domain: url.hostname, path: "/" }]);
}

test("a setlist from empty to the stage and back", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUp(page);
  try {
    await page.goto("/gigs");
    await page.getByPlaceholder("Friday at The Lantern").fill("E2E show");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/gigs\/[a-z0-9]+$/);

    for (const [title, bpm, key] of [["Opener", "132", "E"], ["Ballad", "72", "Am"]]) {
      await page.getByRole("button", { name: "Add song" }).click();
      const row = page.getByRole("listitem").last();
      await row.getByRole("textbox", { name: /title/ }).fill(title);
      await row.getByLabel("BPM").fill(bpm);
      await row.getByLabel("Key").selectOption(key);
      await row.getByLabel("Stage notes").fill(`${title} notes`);
    }
    await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Song 2 title" })).toHaveValue("Ballad");

    await page.getByRole("button", { name: "Gig Mode" }).click();
    await expect(page.getByRole("heading", { name: "Opener" })).toBeVisible();
    await expect(page.getByText("132")).toBeVisible();
    await page.keyboard.press("PageDown");
    await expect(page.getByRole("heading", { name: "Ballad" })).toBeVisible();
    await expect(page.getByText("Ballad notes")).toBeVisible();
    await page.getByRole("button", { name: "← Previous" }).click();
    await expect(page.getByRole("heading", { name: "Opener" })).toBeVisible();

    await page.goto("/gigs");
    await page.getByRole("button", { name: "Delete E2E show" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("No setlists yet")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    const me = await page.request.get("/api/me");
    if (me.ok()) {
      const { profile } = await me.json();
      await page.request.delete("/api/me", { data: { confirmHandle: profile.handle, password } });
    }
  }
});
