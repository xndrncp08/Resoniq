import { expect, test, type Browser, type Page } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

function wav(seconds: number, rate = 8000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 8000), 44 + i * 2);
  return b;
}
async function member(browser: Browser, prefix: string) {
  const context = await browser.newContext({ ...test.info().project.use, baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await signUp(page, prefix);
  const me = await (await page.request.get("/api/me")).json();
  return { page, handle: me.profile.handle as string, close: async () => { await deleteAccount(page); await context.close(); } };
}
/** The player's actual position, from the audio element. */
const playhead = (p: Page) => p.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime);

test("a host and a guest hear the same moment, see each other's feedback, and pause together", async ({ browser }) => {
  const host = await member(browser, "host");
  const guest = await member(browser, "guest");
  try {
    const { riff } = await (await host.page.request.post("/api/riffs", { data: { title: "Room demo" } })).json();
    await host.page.goto(`/riffs/${riff.id}`);
    // Wait for hydration: a file set before React attaches its handler is ignored.
    await host.page.waitForLoadState("networkidle");
    await host.page.locator("input[type=file]").setInputFiles({ name: "demo.wav", mimeType: "audio/wav", buffer: wav(30) });
    await expect(host.page.getByRole("button", { name: "Play First idea" })).toBeVisible();
    const { projectId } = await (await host.page.request.post(`/api/riffs/${riff.id}/project`)).json();
    await host.page.request.post(`/api/conversations/${projectId}/members`, { data: { handle: guest.handle } });

    await host.page.goto(`/messages/${projectId}`);
    await expect(host.page.getByRole("region", { name: "Project shelf" }).getByText("Room demo")).toBeVisible();
    await host.page.getByRole("button", { name: "Listen together" }).click();
    await expect(host.page).toHaveURL(/\/rooms\/[a-z0-9]+$/);
    await guest.page.goto(host.page.url().replace(/^https?:\/\/[^/]+/, ""));
    for (const p of [host.page, guest.page]) {
      await p.getByRole("button", { name: "Join audio" }).click();
      await expect(p.getByText("Live", { exact: true })).toBeVisible();
    }
    await expect(host.page.getByText(`@${guest.handle}`)).toBeVisible({ timeout: 15_000 });

    await host.page.getByRole("button", { name: "Play for everyone" }).click();
    await expect.poll(() => playhead(guest.page), { timeout: 15_000 }).toBeGreaterThan(2);
    // In step: the two players within half a second of each other.
    const [h, g] = await Promise.all([playhead(host.page), playhead(guest.page)]);
    expect(Math.abs(h - g)).toBeLessThan(0.5);

    // Seeking moves everyone.
    await host.page.getByRole("slider", { name: "Position for everyone" }).click({ position: { x: 300, y: 10 } });
    await expect.poll(() => playhead(host.page), { timeout: 5_000 }).toBeGreaterThan(5);
    await expect.poll(() => playhead(guest.page), { timeout: 10_000 }).toBeGreaterThan(5);
    await expect.poll(async () => Math.abs((await playhead(guest.page)) - (await playhead(host.page))), { timeout: 10_000 }).toBeLessThan(0.5);

    await guest.page.getByPlaceholder(/Comment at/).fill("Snare drags here");
    await guest.page.getByRole("button", { name: "Send" }).click();
    await guest.page.getByRole("button", { name: /^React 🔥/ }).click();
    await expect(host.page.getByText("Snare drags here")).toBeVisible({ timeout: 10_000 });
    await expect(host.page.getByRole("region", { name: "Timeline of feedback" }).getByText("🔥")).toBeVisible();

    await host.page.getByRole("button", { name: "Pause for everyone" }).click();
    await expect.poll(() => guest.page.locator("audio").evaluate((a: HTMLAudioElement) => a.paused), { timeout: 10_000 }).toBe(true);

    // The host can take sole control.
    await host.page.getByLabel("Anyone can play, pause and seek").uncheck();
    await expect(guest.page.getByText("The host is controlling playback.")).toBeVisible({ timeout: 10_000 });
  } finally {
    await host.close();
    await guest.close();
  }
});
