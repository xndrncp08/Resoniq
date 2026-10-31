import { collectErrors } from "./errors";
import { expect, test, type Page } from "@playwright/test";

// Fresh visitors see the consent banner; these specs aren't about it.
async function dismissConsent(page: Page) {
  const reject = page.getByRole("button", { name: "Reject optional" });
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function openStudio(page: Page) {
  const errors = collectErrors(page);
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

// ── Amp Studio 2.0: real audio, the pedalboard, the library and preset files ──

/** The loudest output peak the meter shows over a while (it holds peaks for ~0.9 s). */
async function outputPeak(page: Page, ms = 2500) {
  const peak = page.locator("[data-meter=Out] [data-peak]");
  let max = -100;
  for (let t = 0; t < ms; t += 150) {
    const n = Number((await peak.textContent())?.replace("−", "-"));
    if (Number.isFinite(n)) max = Math.max(max, n);
    await page.waitForTimeout(150);
  }
  return max;
}

test("the controls change what you hear: master down lowers the measured output", async ({ page }) => {
  const errors = await openStudio(page);
  await page.getByRole("button", { name: /^Amp:/ }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  const loud = await outputPeak(page);
  expect(loud).toBeGreaterThan(-40);
  const master = page.getByRole("slider", { name: "Master" });
  await master.focus();
  await master.press("Home");
  await expect(master).toHaveAttribute("aria-valuenow", "0");
  // Let the meter's peak hold (~0.9 s) let go of the louder level first.
  await page.waitForTimeout(1500);
  const quiet = await outputPeak(page);
  expect(quiet).toBeLessThan(loud - 6);
  await page.getByRole("button", { name: "Stop" }).click();
  expect(errors).toEqual([]);
});

test("every amp in the library loads its panel without errors", async ({ page }) => {
  const errors = await openStudio(page);
  await page.getByRole("button", { name: /^Amp:/ }).click();
  const amps = page.getByRole("radiogroup", { name: "Amp" }).getByRole("radio");
  const count = await amps.count();
  expect(count).toBeGreaterThanOrEqual(10);
  for (let i = 0; i < count; i++) {
    await amps.nth(i).click();
    await expect(amps.nth(i)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("slider").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("pedals: add from the library, bypass, move across the amp by keyboard and by dragging, undo", async ({ page }) => {
  const errors = await openStudio(page);
  await page.getByRole("button", { name: "Add pedal" }).first().click();
  await page.getByRole("dialog", { name: "Add a pedal" }).getByRole("button", { name: /Moth Fuzz/ }).click();
  await expect(page.getByRole("button", { name: /^Edit Moth Fuzz/ })).toBeVisible();
  await page.getByRole("button", { name: "Add pedal" }).first().click();
  await page.getByRole("dialog", { name: "Add a pedal" }).getByRole("button", { name: /Echo Room/ }).click();

  // Bypass from the board's footswitch.
  const fuzzSwitch = page.getByRole("switch", { name: /^Moth Fuzz/ }).first();
  await fuzzSwitch.click();
  await expect(fuzzSwitch).toHaveAttribute("aria-checked", "false");

  // Keyboard: one step right crosses the amp.
  const handle = page.getByRole("button", { name: "Move Moth Fuzz" });
  await handle.focus();
  await handle.press("ArrowRight");
  await expect(page.getByText(/Moth Fuzz: after the cabinet/)).toBeAttached();

  // Drag the delay to the far left, in front of everything.
  const delay = page.getByRole("button", { name: "Move Echo Room" });
  await delay.scrollIntoViewIfNeeded();
  const from = (await delay.boundingBox())!;
  const amp = (await page.getByRole("button", { name: /^Amp:/ }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let x = from.x; x > amp.x - 80; x -= 20) await page.mouse.move(x, from.y + 4);
  await page.mouse.up();
  await expect(page.getByText(/Echo Room: before the amp/)).toBeAttached();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("cabinet: speaker, mic and mic placement are real controls", async ({ page }) => {
  const errors = await openStudio(page);
  await page.getByRole("radio", { name: /Ceramic 70 W/ }).click();
  await expect(page.locator(".studio-readout")).toHaveText("SPEAKER CERAMIC 70 W");
  await page.getByRole("radio", { name: "Ribbon" }).click();
  await expect(page.getByRole("radio", { name: "Ribbon" })).toHaveAttribute("aria-checked", "true");
  const mic = page.getByRole("slider", { name: "Mic position on the speaker" });
  await mic.focus();
  await mic.press("End");
  await mic.press("ArrowRight");
  await expect(mic).toHaveAttribute("aria-valuenow", "10");
  expect(errors).toEqual([]);
});

test("preset files: export, import, and a readable refusal for junk", async ({ page }, info) => {
  const errors = await openStudio(page);
  await page.getByRole("radio", { name: /Bastion 2×12/ }).click();
  await page.getByRole("button", { name: "Preset actions" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export preset file" }).click();
  const file = info.outputPath("sound.resoniq.json");
  await (await download).saveAs(file);

  await page.getByRole("radio", { name: /Satchel 1×12/ }).click();
  await page.getByRole("button", { name: "Preset actions" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import preset file…" }).click();
  await (await chooser).setFiles(file);
  // Importing replaces unsaved work, so it asks first.
  await page.getByRole("dialog", { name: "Unsaved changes" }).getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByText(/^Loaded “New sound”/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Bastion 2×12/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Preset actions" }).click();
  const chooser2 = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import preset file…" }).click();
  await (await chooser2).setFiles({ name: "junk.json", mimeType: "application/json", buffer: Buffer.from("{\"hello\":1}") });
  await expect(page.getByText("That file isn't a Resoniq studio preset.")).toBeVisible();
  expect(errors).toEqual([]);
});
