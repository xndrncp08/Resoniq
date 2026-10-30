import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

// Chrome's fake capture device: a real MediaRecorder recording of a generated tone.
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

test("records a take from the microphone and keeps it", async ({ page }) => {
  await signUp(page, "rec");
  try {
    await page.goto("/riffs");
    await page.getByRole("button", { name: "New riff" }).click();
    await page.getByRole("button", { name: "Record a take" }).click();
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Stop" }).click();
    await page.getByRole("button", { name: "Keep take" }).click();
    await expect(page.getByRole("button", { name: "Play First idea" })).toBeVisible();
    const src = await page.locator("audio").first().getAttribute("src");
    expect((await page.request.get(src!)).headers()["content-type"]).toMatch(/^audio\/(webm|mp4|ogg)$/);
  } finally {
    await deleteAccount(page);
  }
});
