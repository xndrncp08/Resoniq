import { collectErrors } from "./errors";
import { expect, test, type Page } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

// Chrome's fake capture device: a real MediaRecorder recording of a generated tone.
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

type AudioProbe = { created: number; closed: number; doubleClosed: number; failDecode: boolean; liveTracks: () => number };
declare global { interface Window { __audio: AudioProbe } }

/** Counts AudioContexts opened and closed (a second close on the same one is a bug), can make decoding fail, and tracks mic streams. */
async function probeAudio(page: Page) {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    const probe: AudioProbe = { created: 0, closed: 0, doubleClosed: 0, failDecode: false, liveTracks: () => streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length };
    window.__audio = probe;
    // A WeakSet rather than a #private field: Playwright's transform of this function has no helper for those in the page.
    const closed = new WeakSet<AudioContext>();
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); probe.created++; }
      close() {
        if (closed.has(this)) probe.doubleClosed++;
        else probe.closed++;
        closed.add(this);
        return super.close();
      }
      decodeAudioData(...args: Parameters<AudioContext["decodeAudioData"]>) {
        return probe.failDecode ? Promise.reject(new DOMException("Unable to decode audio data", "EncodingError")) : super.decodeAudioData(...args);
      }
    };
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await getUserMedia(c); streams.push(s); return s; };
  });
}
const audio = (page: Page) => page.evaluate(() => ({ created: window.__audio.created, closed: window.__audio.closed, doubleClosed: window.__audio.doubleClosed, liveTracks: window.__audio.liveTracks() }));

async function recordFor(page: Page, ms: number) {
  await page.goto("/riffs");
  await page.getByRole("button", { name: "New riff" }).click();
  await page.getByRole("button", { name: "Record a take" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await page.waitForTimeout(ms);
}

test.beforeEach(({ browserName }) => test.skip(browserName !== "chromium", "The fake capture device is a Chrome flag; WebKit can't simulate a microphone here."));

test("records a take from the microphone and keeps it, releasing the mic and audio once", async ({ page }) => {
  const errors = collectErrors(page);
  await probeAudio(page);
  await signUp(page, "rec");
  try {
    await recordFor(page, 2500);
    await page.getByRole("button", { name: "Stop" }).click();
    await page.getByRole("button", { name: "Keep take" }).click();
    await expect(page.getByRole("button", { name: "Play First idea" })).toBeVisible();
    // The meter's context and the decoder's context are both closed, each exactly once, and the mic is off.
    expect(await audio(page)).toEqual({ created: 2, closed: 2, doubleClosed: 0, liveTracks: 0 });
    expect(errors).toEqual([]);
    const src = await page.locator("audio").first().getAttribute("src");
    expect((await page.request.get(src!)).headers()["content-type"]).toBe("audio/mp4");
  } finally {
    await deleteAccount(page);
  }
});

test("a take this browser can't decode is still kept, without a duration, and nothing leaks", async ({ page }) => {
  const errors = collectErrors(page);
  await probeAudio(page);
  await signUp(page, "rec-decode");
  try {
    await recordFor(page, 1500);
    await page.getByRole("button", { name: "Stop" }).click();
    await page.evaluate(() => { window.__audio.failDecode = true; });
    await page.getByRole("button", { name: "Keep take" }).click();
    await expect(page.getByRole("button", { name: "Play First idea" })).toBeVisible();
    expect(await audio(page)).toEqual({ created: 2, closed: 2, doubleClosed: 0, liveTracks: 0 });
    const riffId = page.url().split("/riffs/")[1];
    const { riff } = await (await page.request.get(`/api/riffs/${riffId}`)).json();
    expect(riff.allTakes).toEqual([expect.objectContaining({ durationSec: null, peaks: null })]);
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});

test("leaving mid-recording asks first, and discarding releases the mic", async ({ page }) => {
  const errors = collectErrors(page);
  await probeAudio(page);
  await signUp(page, "rec-leave");
  try {
    await recordFor(page, 1000);
    await page.getByRole("link", { name: "Explore", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("the recording in progress");
    await dialog.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect.poll(() => audio(page)).toEqual({ created: 1, closed: 1, doubleClosed: 0, liveTracks: 0 });
    expect(errors).toEqual([]);
  } finally {
    await deleteAccount(page);
  }
});
