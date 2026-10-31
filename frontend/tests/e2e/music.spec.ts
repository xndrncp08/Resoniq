import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";
import { collectErrors } from "./errors";

test("original music is browsable by genre and shows on Explore", async ({ page }) => {
  const errors = collectErrors(page);
  await signUp(page, "music");
  try {
    const title = `Midnight Ferry ${Date.now().toString(36)}`;
    expect((await page.request.patch("/api/me", { data: { genres: ["jazz"] } })).ok()).toBe(true);
    expect((await page.request.post("/api/posts", { data: { title, body: "First single.", category: "ORIGINAL" } })).ok()).toBe(true);
    await page.goto("/music");
    await expect(page.getByRole("heading", { name: "New music from people who play" })).toBeVisible();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.getByRole("navigation", { name: "Genres" }).getByRole("link", { name: "jazz", exact: true }).click();
    await expect(page).toHaveURL(/genre=jazz/);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.getByRole("link", { name: "For you" }).click();
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "New music" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});
