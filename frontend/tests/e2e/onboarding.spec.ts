import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";
import { collectErrors } from "./errors";

test("a new musician picks what they play and is pointed to first steps", async ({ page }) => {
  const errors = collectErrors(page);
  await signUp(page, "welcome");
  try {
    await page.goto("/feed");
    const card = page.getByRole("region", { name: "Getting started" });
    await expect(card).toContainText("0 of 3");
    await card.getByRole("link", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Resoniq" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.getByRole("button", { name: "Bass", exact: true }).click();
    await page.getByRole("button", { name: "jazz", exact: true }).click();
    await page.getByLabel("Another genre").fill("Math Rock");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("button", { name: "math rock", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("listitem", { name: "Step 1: What do you play? (done)" })).toBeVisible();
    await expect(page.getByText("1 of 3 done")).toBeVisible();
    const me = await (await page.request.get("/api/me")).json();
    expect(me.profile).toMatchObject({ instruments: ["bass"], genres: ["jazz", "math rock"] });

    await page.getByRole("link", { name: /Record a riff/ }).click();
    await expect(page).toHaveURL(/\/riffs$/);
    await page.goto("/feed");
    await page.getByRole("button", { name: "Hide getting started" }).click();
    await expect(page.getByRole("region", { name: "Getting started" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "What are you working on?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Getting started" })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});
