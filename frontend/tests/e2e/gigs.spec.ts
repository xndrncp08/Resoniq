import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

/** Gig Mode end to end: build a setlist, save it, step through it on stage, delete it. Needs sign-ups enabled. */
test("a setlist from empty to the stage and back", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUp(page, "gig");
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
    await deleteAccount(page);
  }
});
