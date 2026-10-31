import { collectErrors } from "./errors";
import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

test("save with a note, hear the old version in B, restore it", async ({ page }) => {
  const errors = collectErrors(page);
  await signUp(page, "hist");
  try {
    await page.goto("/studio");
    await page.getByRole("button", { name: "Save as…" }).click();
    await page.getByRole("dialog", { name: "Save as a new sound" }).getByRole("textbox", { name: "Name" }).fill("History test");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/studio\?tone=/);

    // Change the gain and save in place with a revision note.
    await page.getByRole("button", { name: /^Amp:/ }).click();
    const gain = page.getByRole("slider", { name: "Gain" });
    await gain.focus();
    await gain.press("End");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Save changes" });
    await dialog.getByPlaceholder("Darker for the verse; less delay").fill("All the gain");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("[aria-live=polite]").getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Preset actions" }).click();
    await page.getByRole("menuitem", { name: "History…" }).click();
    const history = page.getByRole("dialog", { name: "History" });
    await expect(history.getByText("All the gain")).toBeVisible();
    await expect(history.getByText("Gain 5.0 → 10.0")).toBeVisible();

    // The original goes into B: A keeps 10, B plays 5.
    await history.getByRole("button", { name: "Hear in B" }).click();
    await page.getByRole("button", { name: "B", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Gain" })).toHaveAttribute("aria-valuenow", "5");
    await page.getByRole("button", { name: "A", exact: true }).click();
    await expect(page.getByRole("slider", { name: "Gain" })).toHaveAttribute("aria-valuenow", "10");

    await page.getByRole("button", { name: "Preset actions" }).click();
    await page.getByRole("menuitem", { name: "History…" }).click();
    await page.getByRole("dialog", { name: "History" }).getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Restored. The version you replaced is still in the history.")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Gain" })).toHaveAttribute("aria-valuenow", "5");

    // The tone page shows the same history to its owner.
    const id = new URL(page.url()).searchParams.get("tone");
    await page.goto(`/t/${id}`);
    await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
    await expect(page.getByText("Restored", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});
