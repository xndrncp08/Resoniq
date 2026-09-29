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

// Chain position ordering — dynamics/drive pedals sit before the amp,
// modulation/time effects usually sit after (in the amp's effects loop
// or at the end of the chain).
export function chainPosition(name: string): "pre" | "post" {
  const kind = classifyEffect(name);
  return kind === "dynamics" || kind === "drive" ? "pre" : "post";
}