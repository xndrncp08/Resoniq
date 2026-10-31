import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

function wav(seconds = 2, rate = 8000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 330 * i) / rate) * 9000), 44 + i * 2);
  return b;
}

test("a take goes from the vault to the profile, playable by anyone who sees the post", async ({ page, browser }) => {
  await signUp(page, "pub");
  try {
    const me = (await (await page.request.get("/api/me")).json()).profile.handle as string;
    const { riff } = await (await page.request.post("/api/riffs", { data: { title: "Glass Harbour", key: "F#m", bpm: 76 } })).json();
    await page.goto(`/riffs/${riff.id}`);
    await page.waitForLoadState("networkidle");
    await page.locator("input[type=file]").setInputFiles({ name: "take.wav", mimeType: "audio/wav", buffer: wav() });
    await expect(page.getByRole("button", { name: "Play First idea" })).toBeVisible();
    // The take row never widens the page on a phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    // Before publishing, a signed-out visitor can't hear it.
    const src = (await page.locator("audio").first().getAttribute("src"))!;
    const anon = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    expect((await anon.request.get(src)).status()).toBe(404);

    await page.getByRole("button", { name: "Publish First idea" }).click();
    const dialog = page.getByRole("dialog", { name: "Publish" });
    await dialog.getByRole("textbox", { name: "About it" }).fill("First take, straight into the interface.");
    await dialog.getByRole("textbox", { name: "Role" }).fill("Guitar and vocals");
    await dialog.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/p\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "Glass Harbour" })).toBeVisible();
    await expect(page.getByText("Recording · F#m · 76 BPM")).toBeVisible();
    await expect(page.getByText("(Guitar and vocals)")).toBeVisible();

    expect((await anon.request.get(src)).headers()["content-type"]).toBe("audio/wav");
    await anon.close();

    // A second take becomes an alternate mix of the release.
    const postUrl = page.url();
    await page.goto(`/riffs/${riff.id}`);
    await page.waitForLoadState("networkidle");
    await page.locator("input[type=file]").setInputFiles({ name: "take2.wav", mimeType: "audio/wav", buffer: wav(3) });
    await expect(page.getByRole("button", { name: "Play Take 2" })).toBeVisible();
    await page.goto(postUrl);
    await page.getByRole("button", { name: "Manage release" }).click();
    const manage = page.getByRole("dialog", { name: "Manage release" });
    await manage.getByRole("combobox", { name: "Add a take" }).selectOption({ label: "Glass Harbour · Take 2" });
    await manage.getByRole("textbox", { name: "Mix name" }).nth(1).fill("Acoustic");
    await manage.getByRole("button", { name: "Save changes" }).click();
    await expect(manage.getByRole("region", { name: "Earlier versions" })).toBeVisible();
    await manage.getByRole("button", { name: "Close" }).first().click();
    const mixes = page.getByRole("radiogroup", { name: "Mix" });
    await expect(mixes.getByRole("radio")).toHaveCount(2);
    await mixes.getByRole("radio", { name: "Acoustic" }).click();
    await expect(page.getByRole("button", { name: "Play Glass Harbour (Acoustic)" })).toBeVisible();

    await page.goto(`/u/${me}?tab=music`);
    await expect(page.getByRole("link", { name: "Glass Harbour" })).toBeVisible();
  } finally {
    await deleteAccount(page);
  }
});
