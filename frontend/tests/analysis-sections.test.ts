import { describe, expect, it } from "vitest";
import { GEAR_PROFILES, translate, translationText } from "@/lib/gear-translate";
import { sectionAnalysis, recipeCoreFromAnalysis } from "@/lib/tone-recipe";
import { TANK_G_AMPS } from "@/lib/devices/tank-g";
import type { EngineAnalysis, EngineSection } from "@/types/engine";
import { validRecipe } from "./fixtures";

const recipe = (gain: number, family = "Marshall") => ({ ...validRecipe(), amp: { family, model: `${family} amp`, gain, bass: 50, mids: 70, treble: 60, presence: 55 }, pedalboard: [{ slot: 1, name: "Spring reverb", type: "time", enabled: true }] }) as never;

describe("recommendations for the musician's own gear", () => {
  it("covers every profile without naming a brand the musician didn't choose", () => {
    for (const g of GEAR_PROFILES) {
      const t = translate(recipe(55), g.id, { centroid_hz: 2900, estimated_reverb_tail_s: 1.8 });
      expect(t.steps.length, g.id).toBeGreaterThan(2);
      expect(t.notes.join(" "), g.id).toMatch(/starting point/i);
      if (g.id !== "tank-g") expect(JSON.stringify(t), g.id).not.toMatch(/marshall|fender|mesa|vox|evh|m-vave/i);
    }
  });

  it("explains settings with the measurement behind them", () => {
    const t = translate(recipe(55), "amp-3band", { centroid_hz: 2900, saturation: 0.6 });
    expect(t.steps.find((s) => s.control === "Treble")?.why).toMatch(/2900 Hz/);
    expect(t.steps.find((s) => s.control === "Gain")?.why).toMatch(/60%/);
  });

  it("picks a real TANK-G slot by gain and links to its presets", () => {
    const clean = translate(recipe(20, "Fender"), "tank-g", {});
    const heavy = translate(recipe(90, "Metal"), "tank-g", {});
    const slot = (t: ReturnType<typeof translate>) => Number(t.steps[0].setting.match(/Slot (\d)/)![1]);
    expect(TANK_G_AMPS.find((a) => a.slot === slot(clean))!.gain).toBe("clean");
    expect(TANK_G_AMPS.find((a) => a.slot === slot(heavy))!.gain).toBe("distortion");
    expect(heavy.link?.href).toBe(`/gear/m-vave-tank-g?amp=${slot(heavy)}`);
  });

  it("adds a drive pedal on two-knob amps when the sound has more gain than they give", () => {
    expect(translate(recipe(80), "amp-2band", {}).steps.some((s) => s.control === "Drive pedal")).toBe(true);
    expect(translate(recipe(20), "amp-2band", {}).steps.some((s) => s.control === "Drive pedal")).toBe(false);
    expect(translationText("Song", "Amp", translate(recipe(20), "amp-2band", {}))).toMatch(/^Song — Amp/);
  });
});

describe("sections of an analysis", () => {
  const section = (id: string, type: string, gain: number): EngineSection => ({
    id, type, start_s: 0, end_s: 30, traits: [], character: { rms_db: -12, centroid_hz: 1500, low_db: -6, mid_db: -4, high_db: -12, flatness_db: -30 },
    excerpt: { start_s: 5, duration_s: 25, total_s: 120 }, raw_features: { centroid_hz: 1500 },
    tone_profile: { gain_percent: gain, eq: { bass: 50, mid: 50, treble: 50 }, amp_family: "x", cabinet: "4x12", pickup_position: "bridge", effects_chain: [], playing_style_tags: [], match_confidence: 60 },
    recipe: { ...validRecipe(), amp: { ...validRecipe().amp, gain }, source: "heuristic" } as never,
  });
  const analysis = { raw_features: {}, tone_profile: section("s0", "A", 70).tone_profile, recipe: section("s0", "A", 70).recipe, sections: [section("s0", "A", 70), section("s1", "B", 20)], main_section: "s0" } as EngineAnalysis;

  it("reads any section like a whole analysis, with its own excerpt", () => {
    const b = sectionAnalysis(analysis, "s1")!;
    expect(recipeCoreFromAnalysis(b).amp.gain).toBe(20);
    expect(b.analysis_window).toEqual({ start_s: 5, duration_s: 25, total_s: 120 });
    expect(sectionAnalysis(analysis, "nope")).toBeNull();
  });
});
