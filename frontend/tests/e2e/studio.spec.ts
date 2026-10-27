import { expect, test, type Page } from "@playwright/test";

// Fresh visitors see the consent banner; these specs aren't about it.
async function dismissConsent(page: Page) {
  const reject = page.getByRole("button", { name: "Reject optional" });
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function openStudio(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/feed");
  await dismissConsent(page);
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Amp Studio" })).toBeVisible();
  await page.getByRole("button", { name: /^Cabinet/ }).first().click();
  return errors;
}

test("switching between every cabinet never crashes and the readout names it", async ({ page }) => {
  const errors = await openStudio(page);
  for (const cab of ["Aria 2×12", "Satchel 1×12", "Monolith 4×12", "Aria 2×12"]) {
    await page.getByRole("radio", { name: new RegExp(cab) }).click();
    await expect(page.getByRole("radio", { name: new RegExp(cab) })).toHaveAttribute("aria-checked", "true");
  }
  await page.getByRole("switch", { name: "Cabinet" }).click();
  await expect(page.locator(".studio-readout")).toHaveText("CABINET OFF");
  expect(errors).toEqual([]);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("unsaved studio work asks before a link or Back takes it away", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("radio", { name: /Aria 2×12/ }).click();
  await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();

  // Back: keep editing stays put with the work intact.
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/studio/);
  await expect(page.getByRole("radio", { name: /Aria 2×12/ })).toHaveAttribute("aria-checked", "true");

  // A link (the side rail on desktop, the bottom bar on phones): discard leaves.
  await page.getByRole("link", { name: "Explore", exact: true }).first().click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/explore/);
});

test("nothing unsaved means no prompt", async ({ page }) => {
  await openStudio(page);
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Unsaved changes" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/feed/);
});
