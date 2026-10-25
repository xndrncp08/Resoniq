import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { seed } from "@/prisma/seed";
import { createTone, getTone, remixTone, updateTone } from "@/lib/tones";
import { presetRig } from "@/lib/tone-draft-validation";
import { TANK_G_PRESETS } from "@/lib/tank-g-presets";
import { constrainToDevice, patchFromTankG, tankGRigFromPatch, TANK_G_STUDIO } from "@/lib/studio/devices";
import { defaultPatch, parseStudioPatch } from "@/lib/studio/patch";
import { parseRecipeCore } from "@/lib/tone-validation";
import { validRecipe } from "../fixtures";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

const tankRig = async () => presetRig(prisma as unknown as Prisma.TransactionClient, TANK_G_PRESETS[0]);

describe("studio persistence", () => {
  it("saves a studio patch beside an analysis recipe without relabelling the analysis", async () => {
    const me = await makeActor();
    const recipe = parseRecipeCore(validRecipe());
    const id = await createTone(me, { name: "Analysed", data: { version: 2, recipe } });
    const studio = parseStudioPatch(defaultPatch("basalt"));
    await updateTone(me, id, { data: { version: 2, studio } });
    const tone = (await getTone(id, me.id))!;
    expect(tone.studio?.amp.model).toBe("basalt");
    expect(tone.inferred).toEqual(recipe);
    expect(tone.recipeEdited).toBe(false);
  });

  it("enforces the device's rules on hardware presets, in the database path too", async () => {
    await seed(prisma);
    const me = await makeActor();
    const rig = await tankRig();
    const id = await createTone(me, { name: "My TANK-G", rig });
    const patch = constrainToDevice({ ...patchFromTankG(rig), amp: { ...patchFromTankG(rig).amp, gain: 9 } }, TANK_G_STUDIO);
    await updateTone(me, id, { rig: tankGRigFromPatch(patch, rig) });
    expect((await getTone(id, me.id))!.declared?.amp?.settings.Gain).toBe(9);
    // Something the pedal can't hold: a separate EQ block.
    await expect(updateTone(me, id, { rig: { ...rig, eq: { "800Hz": 3 } } })).rejects.toMatchObject({ status: 400 });
  });

  it("remixing someone else's sound into the studio credits them and keeps their rig valid", async () => {
    await seed(prisma);
    const owner = await makeActor();
    const me = await makeActor();
    const rig = await tankRig();
    const source = await createTone(owner, { name: "Theirs", rig, visibility: "PUBLIC" });
    const copy = await remixTone(me, source);
    const patch = constrainToDevice(patchFromTankG(rig), TANK_G_STUDIO);
    await updateTone(me, copy, { name: "Mine now", rig: tankGRigFromPatch({ ...patch, gate: { on: true, threshold: -50 } }, rig) });
    const tone = (await getTone(copy, me.id))!;
    expect(tone.remixOf?.id).toBe(source);
    expect(tone.declared?.chain[0].category).toBe("gate");
  });
});
