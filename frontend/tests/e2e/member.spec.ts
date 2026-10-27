import { expect, test, type Page } from "@playwright/test";

/**
 * A member's day: sign up, write a post, leave and come back to the draft,
 * edit the profile with a failed save in between, then delete the account.
 * Needs email/password sign-ups enabled on the target.
 */
const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@resoniq.test`;
const password = "E2e-Riff-Pass-2026!";

async function signUp(page: Page) {
  const res = await page.request.post("/api/register", { data: { email, password, name: "E2E Player" } });
  test.skip(!res.ok(), `Sign-ups unavailable here (${res.status()})`);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).not.toHaveURL(/\/login/);
}

async function deleteAccount(page: Page) {
  const me = await page.request.get("/api/me");
  if (!me.ok()) return;
  const { profile } = await me.json();
  await page.request.delete("/api/me", { data: { confirmHandle: profile.handle, password } });
}

test("drafts come back, failed saves keep the work, and nothing is lost on the way", async ({ page }) => {
  await page.goto("/cookies");
  await page.getByRole("button", { name: "Accept all" }).first().click();
  await signUp(page);
  try {
    // Composer: the draft survives leaving and is offered back, not forced.
    await page.goto("/new");
    await page.getByLabel("Title").fill("Riff for feedback");
    await page.getByLabel("Post text").fill("Does the bend at 0:42 sit right?");
    await expect(page.getByText("Draft saved on this device")).toBeVisible();
    await page.reload();
    await expect(page.getByText(/You have an unsent draft/)).toBeVisible();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Riff for feedback");

    // Settings: a save the server refuses keeps the edits and says why.
    await page.goto("/settings");
    await page.getByLabel("Bio").fill("Prog guitarist");
    await page.getByLabel("Handle").fill("x");
    await page.goBack();
    const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Nothing was lost");
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByLabel("Bio")).toHaveValue("Prog guitarist");
  } finally {
    await deleteAccount(page);
  }
});
