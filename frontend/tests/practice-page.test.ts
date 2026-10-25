import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), tone: vi.fn() }));
vi.mock("@/lib/api", () => ({ optionalActor: mocks.actor }));
vi.mock("@/lib/tones", () => ({ getTone: mocks.tone }));
import PracticePage from "@/app/(app)/practice/page";

beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ id: "viewer" }); mocks.tone.mockResolvedValue(null); });

it.each([undefined, ["one", "two"], "x".repeat(101)])("ignores invalid optional tone references (%s)", async (tone) => {
  await PracticePage({ searchParams: Promise.resolve({ tone }) });
  expect(mocks.tone).not.toHaveBeenCalled();
  expect(mocks.actor).not.toHaveBeenCalled();
});

it("loads a tone through the existing viewer-aware access check", async () => {
  await PracticePage({ searchParams: Promise.resolve({ tone: "tone-id" }) });
  expect(mocks.tone).toHaveBeenCalledWith("tone-id", "viewer");
});
