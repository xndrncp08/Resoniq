import { expect, test, type Browser, type Page } from "@playwright/test";
import { deleteAccount, signUp } from "./account";
import { collectErrors } from "./errors";

async function member(browser: Browser, prefix: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, ...test.info().project.use });
  const page = await context.newPage();
  await signUp(page, prefix);
  const me = await (await page.request.get("/api/me")).json();
  return { page, handle: me.profile.handle as string, close: async () => { await deleteAccount(page); await context.close(); } };
}
const lyrics = (page: Page, name: string) => page.getByRole("textbox", { name: `Lyrics and chords for ${name}` });

test("two writers edit the same song at once; nothing is lost, and the chart reaches the stage", async ({ browser }) => {
  const a = await member(browser, "writer-a");
  const b = await member(browser, "writer-b");
  try {
    // A starts a song from a riff, puts it in a project and adds B.
    const { riff } = await (await a.page.request.post("/api/riffs", { data: { title: "Night Shift", key: "Am", bpm: 96 } })).json();
    const { projectId } = await (await a.page.request.post(`/api/riffs/${riff.id}/project`)).json();
    expect((await a.page.request.post(`/api/conversations/${projectId}/members`, { data: { handle: b.handle } })).ok()).toBe(true);
    await a.page.goto(`/riffs/${riff.id}`);
    await a.page.getByRole("button", { name: "Write a song from it" }).click();
    await expect(a.page).toHaveURL(/\/write\/[a-z0-9]+$/);
    // Focus changes during a slow heartbeat must coalesce rather than fan out requests.
    let active = 0;
    let peak = 0;
    await a.page.route("**/api/canvases/*/presence", async (route) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 600));
      try { await route.continue(); } finally { active--; }
    });
    await lyrics(a.page, "Verse 1").click();
    await expect.poll(() => active).toBe(1);
    await a.page.evaluate(() => {
      for (let i = 0; i < 4; i++) document.dispatchEvent(new Event("visibilitychange"));
    });
    await lyrics(a.page, "Chorus").click();
    await a.page.waitForTimeout(1500);
    expect(peak).toBe(1);
    await a.page.unroute("**/api/canvases/*/presence");
    const url = a.page.url();
    await b.page.goto(url.replace(/^https?:\/\/[^/]+/, ""));
    await expect(lyrics(b.page, "Chorus")).toBeVisible();

    // Each sees the other, and which section they're in.
    await expect(a.page.getByLabel("Also here").getByText(`@${b.handle}`)).toBeVisible({ timeout: 10_000 });
    await lyrics(b.page, "Chorus").click();
    await expect(a.page.getByText(`@${b.handle} is here`)).toBeVisible({ timeout: 10_000 });

    // Different sections at the same moment: both land.
    await lyrics(a.page, "Verse 1").fill("[Am]Lights on the [F]highway");
    await lyrics(b.page, "Chorus").fill("[C]Hold the [G]line");
    await expect(a.page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(b.page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(lyrics(a.page, "Chorus")).toHaveValue("[C]Hold the [G]line", { timeout: 20_000 });
    await expect(lyrics(b.page, "Verse 1")).toHaveValue("[Am]Lights on the [F]highway", { timeout: 20_000 });

    // The same section, at once: one version stays, the other is kept beside it.
    await Promise.all([lyrics(a.page, "Verse 1").fill("[Am]A's words"), lyrics(b.page, "Verse 1").fill("[Am]B's words")]);
    const copy = (p: Page) => p.getByRole("textbox", { name: "Lyrics and chords for Verse 1 (your edit)" }).count();
    await expect.poll(async () => (await copy(a.page)) + (await copy(b.page)), { timeout: 25_000 }).toBeGreaterThan(0);
    // Let the merged result save before reading it back.
    await expect(a.page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(b.page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
    await a.page.reload();
    const all = await a.page.locator("textarea").evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
    expect(all).toEqual(expect.arrayContaining(["[Am]A's words", "[Am]B's words"]));

    // Chart view transposes; the song goes into a setlist and shows on stage.
    await a.page.getByRole("radio", { name: "Chart" }).click();
    await a.page.getByRole("button", { name: "Transpose up a semitone" }).click();
    await expect(a.page.getByRole("region", { name: "Verse 1", exact: true }).getByText("A#m").first()).toBeVisible();
    const { setlist } = await (await a.page.request.post("/api/setlists", { data: { name: "Release show" } })).json();
    await a.page.getByRole("button", { name: "Add to a setlist" }).click();
    await a.page.getByRole("dialog", { name: "Add to a setlist" }).getByRole("button", { name: "Add" }).click();
    await expect(a.page.getByText("Added. Gig Mode shows")).toBeVisible();
    await a.page.goto(`/gigs/${setlist.id}/stage`);
    await expect(a.page.getByRole("heading", { name: "Night Shift" })).toBeVisible();
    await expect(a.page.getByText("Hold the")).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("a lost save race survives a failed refetch: the editor retries instead of sticking on Saving", async ({ page }) => {
  const errors = collectErrors(page);
  await signUp(page, "writer-race");
  try {
    const { canvas } = await (await page.request.post("/api/canvases", { data: { title: "Race" } })).json();
    await page.goto(`/write/${canvas.id}`);
    const canvasUrl = new RegExp(`/api/canvases/${canvas.id}$`);
    // The next save "loses" to someone else, and fetching their version fails until the editor reports it.
    let conflict = true;
    let offline = false;
    await page.route(canvasUrl, async (route) => {
      const method = route.request().method();
      if (method === "PUT" && conflict) {
        conflict = false;
        offline = true;
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Someone saved first." }) });
      }
      if (method === "GET" && offline) return route.abort("internetdisconnected");
      return route.continue();
    });
    await page.locator("textarea").first().fill("[G]Second try");
    await expect(page.getByText("Offline · retrying")).toBeVisible({ timeout: 15_000 });
    offline = false;
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.unroute(canvasUrl);
    await page.reload();
    await expect(page.locator("textarea").first()).toHaveValue("[G]Second try");
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});
