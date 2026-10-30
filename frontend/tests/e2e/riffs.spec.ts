import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

/** One second of a 440 Hz tone as a 16-bit mono WAV. */
function wav(seconds = 1, rate = 8000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000 * (1 - i / n)), 44 + i * 2);
  return b;
}

test("an idea from first take to a compared second take, then gone", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signUp(page, "riff");
  try {
    await page.goto("/riffs");
    await expect(page.getByText("Your vault is empty")).toBeVisible();
    await page.getByRole("button", { name: "New riff" }).click();
    await expect(page).toHaveURL(/\/riffs\/[a-z0-9]+\?record=1/);

    for (const label of ["First idea", "Take 2"]) {
      await page.locator("input[type=file]").setInputFiles({ name: "idea.wav", mimeType: "audio/wav", buffer: wav() });
      await expect(page.getByRole("button", { name: `Play ${label}` })).toBeVisible();
    }
    // The waveform came from the browser's decode and the audio is served back.
    const take = page.getByRole("slider", { name: "Position in Take 2" });
    await expect(take.locator("span").first()).toBeAttached();
    const src = await page.locator("audio").first().getAttribute("src");
    expect((await page.request.get(src!)).headers()["content-type"]).toBe("audio/wav");

    for (const box of await page.getByRole("checkbox", { name: "A/B" }).all()) await box.check();
    await expect(page.getByRole("radiogroup", { name: "Which take you hear" })).toBeVisible();

    await page.getByRole("textbox", { name: "Riff name" }).fill("Night drive hook");
    await page.getByLabel("Tags").fill("verse, drop d");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.goto("/riffs");
    await expect(page.getByText("Night drive hook")).toBeVisible();
    await expect(page.getByRole("button", { name: "#drop-d" })).toBeVisible();

    await page.getByText("Night drive hook").click();
    await page.getByRole("button", { name: "Delete riff" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/riffs$/);
    await expect(page.getByText("Your vault is empty")).toBeVisible();
    expect((await page.request.get(src!)).status()).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});
