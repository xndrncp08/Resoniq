export const validRecipe = () => ({
  confidenceScore: 140,
  recipeDescription: "  Plexi crunch. ",
  amp: { family: "Marshall", model: "Plexi-style", gain: 70.6, bass: -3, mids: 50, treble: 55, presence: 40 },
  cabinet: { type: "4x12 closed-back", speaker: "Greenback-style" },
  pickup: "Bridge",
  pedalboard: [
    { slot: 9, name: "Tube Screamer-style", type: "drive", enabled: true, drive: 30, tone: 50, level: 60 },
    { slot: 2, name: "Plate reverb", type: "time", enabled: false, tone: 40, level: 20 },
  ],
  similarArtists: ["Slash"],
});
