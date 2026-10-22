import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { recipeFromStoredTone } from "@/lib/tone-recipe";
import { parseRecipeCore } from "@/lib/tone-validation";
import { validRecipe } from "../fixtures";
import { makeUser, prisma, resetDb } from "./db";

const profile = {
  gain_percent: 62,
  eq: { bass: 45, mid: 55, treble: 60 },
  amp_family: "Plexi-style crunch",
  cabinet: "4x12 closed-back",
  pickup_position: "bridge",
  effects_chain: [{ name: "Plate reverb", confidence: 0.6 }],
  playing_style_tags: ["rhythm"],
  match_confidence: 70,
};

beforeEach(resetDb);

describe("stored tone compatibility", () => {
  it("reads legacy and v2 tones straight from the database", async () => {
    const user = await makeUser();
    await prisma.tone.create({
      data: { userId: user.id, name: "legacy", data: { profile, amp: { gain: 70, bass: 40, mid: 55, treble: 60, presence: 50 } } },
    });
    await prisma.tone.create({ data: { userId: user.id, name: "v2", data: { version: 2, recipe: parseRecipeCore(validRecipe()) } as unknown as Prisma.InputJsonValue } });

    const tones = await prisma.tone.findMany({ orderBy: { name: "asc" } });
    const recipes = tones.map((t) => recipeFromStoredTone(t, null));
    expect(recipes.every(Boolean)).toBe(true);
    expect(recipes[0]?.amp.gain).toBe(70);
  });
});
