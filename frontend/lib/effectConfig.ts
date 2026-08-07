export type Knob = { key: string; label: string; default: number };

export type EffectKind = "dynamics" | "drive" | "modulation" | "time";

const DRIVE_WORDS = ["overdrive", "distortion", "driver", "fuzz", "boost"];
const MOD_WORDS = ["chorus", "tremolo", "phaser", "flanger", "wah"];
const TIME_WORDS = ["delay", "reverb"];

export function classifyEffect(name: string): EffectKind {
  const n = name.toLowerCase();
  if (n.includes("compressor")) return "dynamics";
  if (DRIVE_WORDS.some((w) => n.includes(w))) return "drive";
  if (MOD_WORDS.some((w) => n.includes(w))) return "modulation";
  if (TIME_WORDS.some((w) => n.includes(w))) return "time";
  return "drive";
}

export function knobsFor(name: string): Knob[] {
  switch (classifyEffect(name)) {
    case "dynamics":
      return [
        { key: "sustain", label: "Sustain", default: 55 },
        { key: "tone", label: "Tone", default: 50 },
        { key: "level", label: "Level", default: 60 },
      ];
    case "drive":
      return [
        { key: "drive", label: "Drive", default: 45 },
        { key: "tone", label: "Tone", default: 55 },
        { key: "level", label: "Level", default: 60 },
      ];
    case "modulation":
      return [
        { key: "rate", label: "Rate", default: 35 },
        { key: "depth", label: "Depth", default: 40 },
        { key: "mix", label: "Mix", default: 50 },
      ];
    case "time":
      return [
        { key: "mix", label: "Mix", default: 35 },
        { key: "time", label: "Time", default: 45 },
        { key: "feedback", label: "Feedback", default: 30 },
      ];
  }
}

// Chain position ordering — dynamics/drive pedals sit before the amp,
// modulation/time effects usually sit after (in the amp's effects loop
// or at the end of the chain).
export function chainPosition(name: string): "pre" | "post" {
  const kind = classifyEffect(name);
  return kind === "dynamics" || kind === "drive" ? "pre" : "post";
}