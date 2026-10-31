import { expect, test, type Browser, type Page } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

async function member(browser: Browser, prefix: string) {
  const context = await browser.newContext({ ...test.info().project.use, baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await signUp(page, prefix);
  const me = await (await page.request.get("/api/me")).json();
  return { page, handle: me.profile.handle as string, close: async () => { await deleteAccount(page); await context.close(); } };
}
/** A take uploaded the way the browser does it: reserve, PUT the bytes, complete. */
async function uploadTake(page: Page, riffId: string) {
  const bytes = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(4000)]);
  const { id, upload } = await (await page.request.post(`/api/riffs/${riffId}/takes`, { data: { size: bytes.length, mime: "audio/wav", durationSec: 1 } })).json();
  await page.request.fetch(upload.url, { method: upload.method, headers: upload.headers, data: bytes });
  await page.request.post(`/api/riff-takes/${id}/complete`);
  return id as string;
}

test("a credited musician is told, confirms, and the release reaches their profile", async ({ browser }) => {
  const author = await member(browser, "author");
  const player = await member(browser, "player");
  try {
    const { riff } = await (await author.page.request.post("/api/riffs", { data: { title: "Lantern Hours" } })).json();
    const takeId = await uploadTake(author.page, riff.id);
    const { projectId } = await (await author.page.request.post(`/api/riffs/${riff.id}/project`)).json();
    await author.page.request.post(`/api/conversations/${projectId}/members`, { data: { handle: player.handle } });
    const res = await author.page.request.post("/api/posts", { data: { title: "Lantern Hours", category: "ORIGINAL", release: { takeId, credits: [{ handle: author.handle, role: "Guitar" }, { handle: player.handle, role: "Bass" }] } } });
    const { post } = await res.json();

    // Before confirming, it isn't on the player's profile.
    await player.page.goto(`/u/${player.handle}?tab=music`);
    await expect(player.page.getByText("No music published yet")).toBeVisible();

    await player.page.goto("/notifications");
    await player.page.getByRole("link", { name: /credited you on a release/ }).click();
    await expect(player.page).toHaveURL(new RegExp(`/p/${post.id}`));
    await expect(player.page.getByText("awaiting confirmation")).toBeVisible();
    await player.page.getByRole("group", { name: "Your credit" }).getByRole("button", { name: "Confirm" }).click();
    await expect(player.page.getByRole("group", { name: "Your credit" })).toHaveCount(0);

    await player.page.goto(`/u/${player.handle}?tab=music`);
    await expect(player.page.getByRole("link", { name: "Lantern Hours" })).toBeVisible();
    await author.page.goto("/notifications");
    await expect(author.page.getByText(/confirmed their credit \(Bass\)/)).toBeVisible();
  } finally {
    await author.close();
    await player.close();
  }
});
