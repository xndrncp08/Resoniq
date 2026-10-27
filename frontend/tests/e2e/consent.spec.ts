import { expect, test, type Page } from "@playwright/test";

const resoniqKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("resoniq")));
const consentCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === "resoniq_consent")?.value ?? null;

test("rejecting optional storage keeps the browser clean and is remembered", async ({ page }) => {
  await page.goto("/practice");
  const banner = page.getByRole("region", { name: "Your privacy, your call" });
  await expect(banner).toBeVisible();
  // No cookies or storage before a choice.
  expect(await consentCookie(page)).toBeNull();

  await banner.getByRole("button", { name: "Reject optional" }).click();
  expect(await consentCookie(page)).toMatch(/^1\.p0\.a0\.\d+$/);

  // Streaming briefly holds a second, hidden copy of a section until it's swapped in.
  await expect(page.getByLabel("One thing to work on")).toHaveCount(1);
  await page.getByLabel("One thing to work on").fill("Clean changes at 80");
  await page.getByRole("button", { name: "Save practice note" }).click();
  await expect(page.getByText(/Kept for this visit/)).toBeVisible();
  expect(await resoniqKeys(page)).toEqual([]);

  await page.reload();
  await expect(page.getByRole("region", { name: "Your privacy, your call" })).toHaveCount(0);
});

test("allowing preferences stores them; withdrawing deletes them", async ({ page }) => {
  await page.goto("/cookies");
  await page.getByRole("button", { name: "Accept all" }).first().click();
  expect(await consentCookie(page)).toMatch(/^1\.p1\.a1\.\d+$/);

  await page.goto("/practice");
  await expect(page.getByLabel("One thing to work on")).toHaveCount(1);
  await page.getByLabel("One thing to work on").fill("Land the chorus");
  await page.getByRole("button", { name: "Save practice note" }).click();
  await expect(page.getByText("Saved in this browser.")).toBeVisible();
  expect(await resoniqKeys(page)).toContain("resoniq.practice.v1");

  await page.goto("/cookies");
  await page.getByRole("button", { name: "Cookie settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Cookie settings" });
  await expect(dialog.getByRole("switch", { name: "Essential" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Reject optional" }).click();
  expect(await resoniqKeys(page)).toEqual([]);
  expect(await consentCookie(page)).toMatch(/^1\.p0\.a0\./);
});
