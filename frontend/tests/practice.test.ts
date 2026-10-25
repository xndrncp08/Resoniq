import { afterEach, describe, expect, it, vi } from "vitest";
import { readPracticeNote, startClickTrack, tappedTempo, validLoop } from "@/lib/practice";
import { postPrompt, POST_PROMPTS } from "@/lib/post-prompts";
import { parsePostInput, parseFeedQuery } from "@/lib/posts";

afterEach(() => vi.useRealTimers());

describe("practice tools", () => {
  it("averages tap intervals, clamps extreme tempos and refuses stale or invalid taps", () => {
    expect(tappedTempo([0])).toBeNull();
    expect(tappedTempo([1000, 1500, 2000, 2500])).toBe(120);
    expect(tappedTempo([0, 700, 1500])).toBe(80);
    expect(tappedTempo([0, 20])).toBe(240);
    expect(tappedTempo([0, 2000])).toBe(30);
    for (const taps of [[0, 2500], [1, 1], [10, 5], [0, NaN], [0, Infinity]]) expect(tappedTempo(taps)).toBeNull();
  });

  it("only loops finite ranges within the file with enough separation", () => {
    expect(validLoop(0, 0.25, 3)).toBe(true);
    expect(validLoop(1.5, 3, 3)).toBe(true);
    for (const [a, b, d] of [[0, 0.24, 3], [2, 1, 3], [-1, 1, 3], [0, 4, 3], [0, Infinity, Infinity], [NaN, 1, 2]]) expect(validLoop(a, b, d)).toBe(false);
  });

  it("recovers malformed browser storage without trusting types or oversized notes", () => {
    expect(readPracticeNote("{broken")).toEqual({ goal: "", notes: "" });
    expect(readPracticeNote(null)).toEqual({ goal: "", notes: "" });
    expect(readPracticeNote('{"goal":123,"notes":[]}')).toEqual({ goal: "", notes: "" });
    const note = readPracticeNote(JSON.stringify({ goal: "g".repeat(200), notes: "n".repeat(3000) }));
    expect(note.goal).toHaveLength(160);
    expect(note.notes).toHaveLength(2000);
  });

  it("schedules accented clicks on the audio clock, skips missed beats and cleans up", () => {
    vi.useFakeTimers();
    const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; frequency: { value: number } }[] = [];
    const context = {
      currentTime: 0, state: "running", destination: {},
      createOscillator: () => {
        const node = { frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
        oscillators.push(node);
        return node;
      },
      createGain: () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }),
    };
    const beat = vi.fn();
    const stop = startClickTrack(context as unknown as AudioContext, 120, 3, 0.5, beat);
    expect(oscillators[0].start).toHaveBeenCalledWith(0.04);
    expect(oscillators[0].frequency.value).toBe(1200);
    for (const t of [0.05, 0.5, 0.55, 1, 1.05, 1.5, 1.55]) { context.currentTime = t; vi.advanceTimersByTime(25); }
    expect(oscillators.map((n) => n.frequency.value)).toEqual([1200, 800, 800, 1200]);
    expect(beat.mock.calls.map(([b]) => b)).toEqual([0, 1, 2, 0]);
    context.currentTime = 100;
    vi.advanceTimersByTime(25);
    expect(oscillators).toHaveLength(5);
    expect(oscillators[4].start).toHaveBeenCalledWith(100.04);
    stop();
    expect(oscillators.every((n) => n.disconnect.mock.calls.length === 1)).toBe(true);
    context.currentTime = 101;
    vi.advanceTimersByTime(1000);
    expect(oscillators).toHaveLength(5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not schedule clicks while the browser has suspended audio", () => {
    vi.useFakeTimers();
    const createOscillator = vi.fn();
    const stop = startClickTrack({ state: "suspended", currentTime: 0, createOscillator } as unknown as AudioContext, 80, 4, 0.5, vi.fn());
    vi.advanceTimersByTime(500);
    expect(createOscillator).not.toHaveBeenCalled();
    stop();
  });
});

describe("musician conversations", () => {
  it("only accepts known prompts and produces editable, valid posts without invented activity", () => {
    expect(postPrompt("__proto__")).toBeUndefined();
    expect(postPrompt("unknown")).toBeUndefined();
    expect(postPrompt(undefined)).toBeUndefined();
    for (const prompt of POST_PROMPTS) {
      expect(postPrompt(prompt.id)).toBe(prompt);
      expect(parsePostInput(prompt)).toMatchObject({ title: prompt.title, body: prompt.body, category: prompt.category });
    }
  });

  it("keeps API filters in the supported post categories and time windows", () => {
    expect(parseFeedQuery(new URL("https://resoniq.test/feed?category=QUESTION&sort=top&t=month"))).toEqual({ category: "QUESTION", sort: "top", window: "month" });
    expect(parseFeedQuery(new URL("https://resoniq.test/feed?category=__proto__&sort=x&t=toString"))).toEqual({ category: undefined, sort: undefined, window: "week" });
  });
});
