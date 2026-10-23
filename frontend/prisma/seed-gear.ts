import type { GearKind, PrismaClient } from "@prisma/client";

/**
 * Starter gear catalog: widely known production instruments and equipment,
 * factual brand/model names only (no images, specs or claims about artists).
 * [kind, brand, model, controls?]
 */
type Row = [GearKind, string, string, string[]?];

const AMP = ["Gain", "Bass", "Middle", "Treble", "Presence", "Master"];
const CLEAN = ["Volume", "Treble", "Middle", "Bass", "Reverb"];
const DRIVE = ["Drive", "Tone", "Level"];

export const GEAR: Row[] = [
  // Guitars
  ["GUITAR", "Fender", "American Professional II Stratocaster"], ["GUITAR", "Fender", "Player Telecaster"],
  ["GUITAR", "Fender", "Jazzmaster"], ["GUITAR", "Fender", "Jaguar"], ["GUITAR", "Squier", "Classic Vibe '50s Stratocaster"],
  ["GUITAR", "Gibson", "Les Paul Standard '50s"], ["GUITAR", "Gibson", "SG Standard"], ["GUITAR", "Gibson", "ES-335"],
  ["GUITAR", "Epiphone", "Les Paul Standard"], ["GUITAR", "PRS", "Custom 24"], ["GUITAR", "PRS", "Silver Sky"],
  ["GUITAR", "Ibanez", "RG550"], ["GUITAR", "Ibanez", "AZ2402"], ["GUITAR", "ESP", "E-II Eclipse"],
  ["GUITAR", "Schecter", "Hellraiser C-1"], ["GUITAR", "Jackson", "Soloist SL2"], ["GUITAR", "Gretsch", "G6120 Chet Atkins"],
  ["GUITAR", "Rickenbacker", "330"], ["GUITAR", "Strandberg", "Boden Original 7"], ["GUITAR", "Music Man", "JP15"],
  ["GUITAR", "Taylor", "814ce"], ["GUITAR", "Martin", "D-28"], ["GUITAR", "Yamaha", "Pacifica 112V"],
  // Basses
  ["BASS", "Fender", "Precision Bass"], ["BASS", "Fender", "Jazz Bass"], ["BASS", "Music Man", "StingRay 4"],
  ["BASS", "Rickenbacker", "4003"], ["BASS", "Ibanez", "SR500E"], ["BASS", "Gibson", "Thunderbird"],
  ["BASS", "Sire", "Marcus Miller V7"], ["BASS", "Spector", "NS Dimension 5"], ["BASS", "Dingwall", "NG3"],
  // Pickups
  ["PICKUP", "Seymour Duncan", "JB SH-4"], ["PICKUP", "Seymour Duncan", "'59 SH-1"], ["PICKUP", "DiMarzio", "Super Distortion"],
  ["PICKUP", "DiMarzio", "Tone Zone"], ["PICKUP", "EMG", "81"], ["PICKUP", "EMG", "85"], ["PICKUP", "Fishman", "Fluence Modern"],
  ["PICKUP", "Bare Knuckle", "Aftermath"], ["PICKUP", "Fender", "Custom Shop Fat '50s"], ["PICKUP", "Gibson", "Burstbucker Pro"],
  // Amps
  ["AMP", "Fender", "Twin Reverb", CLEAN], ["AMP", "Fender", "Deluxe Reverb", CLEAN], ["AMP", "Fender", "Bassman 5F6-A", ["Presence", "Middle", "Bass", "Treble", "Volume"]],
  ["AMP", "Marshall", "JCM800 2203", AMP], ["AMP", "Marshall", "1959SLP Plexi", ["Presence", "Bass", "Middle", "Treble", "Volume I", "Volume II"]],
  ["AMP", "Marshall", "JVM410H", AMP], ["AMP", "Vox", "AC30", ["Volume", "Treble", "Bass", "Tone Cut", "Master"]],
  ["AMP", "Mesa/Boogie", "Dual Rectifier", AMP], ["AMP", "Mesa/Boogie", "Mark V", AMP], ["AMP", "EVH", "5150III 50W", AMP],
  ["AMP", "Peavey", "6505+", AMP], ["AMP", "Orange", "Rockerverb 50", AMP], ["AMP", "Orange", "OR15", AMP],
  ["AMP", "Friedman", "BE-100", AMP], ["AMP", "Soldano", "SLO-100", AMP], ["AMP", "Bogner", "Ecstasy", AMP],
  ["AMP", "Diezel", "VH4", AMP], ["AMP", "Dumble", "Overdrive Special", AMP], ["AMP", "Two-Rock", "Classic Reverb Signature", AMP],
  ["AMP", "Roland", "JC-120 Jazz Chorus", ["Volume", "Treble", "Middle", "Bass", "Distortion", "Reverb"]], ["AMP", "Boss", "Katana-100 MkII", AMP],
  ["AMP", "Ampeg", "SVT-CL", ["Gain", "Bass", "Midrange", "Treble", "Master"]], ["AMP", "Darkglass", "Microtubes 900 v2", ["Gain", "Bass", "Low Mids", "Hi Mids", "Treble", "Master"]],
  ["AMP", "Markbass", "Little Mark IV", ["Gain", "Low", "Mid", "High", "Master"]],
  // Cabs
  ["CAB", "Marshall", "1960A 4x12"], ["CAB", "Mesa/Boogie", "Rectifier 4x12"], ["CAB", "Orange", "PPC212"],
  ["CAB", "Fender", "Bassman 4x10"], ["CAB", "Vox", "V212C"], ["CAB", "Ampeg", "SVT-810E"], ["CAB", "Celestion", "Vintage 30 (speaker)"],
  ["CAB", "Celestion", "G12M Greenback (speaker)"], ["CAB", "Jensen", "C12N (speaker)"],
  // Pedals
  ["PEDAL", "Ibanez", "TS9 Tube Screamer", DRIVE], ["PEDAL", "Ibanez", "TS808 Tube Screamer", DRIVE], ["PEDAL", "Boss", "BD-2 Blues Driver", ["Level", "Tone", "Gain"]],
  ["PEDAL", "Boss", "DS-1 Distortion", ["Level", "Tone", "Dist"]], ["PEDAL", "Boss", "SD-1 Super OverDrive", DRIVE], ["PEDAL", "Boss", "CE-2W Chorus", ["Rate", "Depth"]],
  ["PEDAL", "Boss", "DD-8 Digital Delay", ["E.Level", "F.Back", "Time"]], ["PEDAL", "Boss", "RV-6 Reverb", ["E.Level", "Tone", "Time"]], ["PEDAL", "Boss", "TU-3 Tuner"],
  ["PEDAL", "Electro-Harmonix", "Big Muff Pi", ["Volume", "Tone", "Sustain"]], ["PEDAL", "Electro-Harmonix", "Memory Man", ["Level", "Blend", "Feedback", "Delay", "Depth"]],
  ["PEDAL", "Electro-Harmonix", "POG2"], ["PEDAL", "ProCo", "RAT 2", ["Distortion", "Filter", "Volume"]], ["PEDAL", "Klon", "Centaur", ["Gain", "Treble", "Output"]],
  ["PEDAL", "Fulltone", "OCD", ["Volume", "Drive", "Tone"]], ["PEDAL", "MXR", "Phase 90", ["Speed"]], ["PEDAL", "MXR", "Dyna Comp", ["Output", "Sensitivity"]],
  ["PEDAL", "MXR", "Carbon Copy", ["Regen", "Mix", "Delay"]], ["PEDAL", "Dunlop", "Cry Baby GCB95"], ["PEDAL", "Dunlop", "Fuzz Face"],
  ["PEDAL", "Strymon", "BigSky"], ["PEDAL", "Strymon", "Timeline"], ["PEDAL", "Strymon", "Flint", ["Intensity", "Speed", "Mix", "Decay"]],
  ["PEDAL", "Walrus Audio", "Julia", ["Rate", "Depth", "Lag", "D-P-V", "Mix"]], ["PEDAL", "JHS", "Morning Glory", ["Volume", "Drive", "Tone"]],
  ["PEDAL", "Wampler", "Tumnus", ["Gain", "Treble", "Output"]], ["PEDAL", "EarthQuaker Devices", "Plumes", ["Level", "Tone", "Gain"]],
  ["PEDAL", "Keeley", "Compressor Plus", ["Level", "Sustain", "Blend", "Tone"]], ["PEDAL", "Chase Bliss", "Mood MkII"], ["PEDAL", "Death By Audio", "Interstellar Overdriver"],
  ["PEDAL", "TC Electronic", "Hall of Fame 2"], ["PEDAL", "TC Electronic", "Polytune 3"], ["PEDAL", "Darkglass", "B7K Ultra", ["Level", "Blend", "Drive", "Bass", "Lo Mids", "Hi Mids", "Treble"]],
  ["PEDAL", "Tech 21", "SansAmp Bass Driver DI", ["Level", "Blend", "Treble", "Bass", "Presence", "Drive"]], ["PEDAL", "Boss", "NS-2 Noise Suppressor", ["Threshold", "Decay"]],
  ["PEDAL", "ISP", "Decimator II", ["Threshold"]], ["PEDAL", "Universal Audio", "Dream '65 Reverb Amplifier"],
  // Multi-effects and modelers
  ["MODELER", "Line 6", "Helix Floor"], ["MODELER", "Line 6", "HX Stomp"], ["MODELER", "Neural DSP", "Quad Cortex"],
  ["MODELER", "Fractal Audio", "Axe-Fx III"], ["MODELER", "Fractal Audio", "FM3"], ["MODELER", "Kemper", "Profiler Stage"],
  ["MODELER", "Boss", "GT-1000"], ["MODELER", "Headrush", "Pedalboard"], ["MULTIFX", "Boss", "GX-100"], ["MULTIFX", "Zoom", "G6"],
  ["MULTIFX", "Line 6", "POD Go"], ["MULTIFX", "Mooer", "GE300"], ["MULTIFX", "Valeton", "GP-200"],
  ["MULTIFX", "M-VAVE", "TANK-G", ["NOISE GATE", "TYPE", "GAIN", "TREBLE", "MIDDLE", "BASS", "VOLUME", "MOD FX", "MOD SPEED", "DLY MIX", "DLY TIME", "RVB DECAY", "RVB MIX", "IR CAB", "MASTER"]],
  // Plugins
  ["PLUGIN", "Neural DSP", "Archetype: Plini"], ["PLUGIN", "Neural DSP", "Archetype: Gojira"], ["PLUGIN", "Neural DSP", "Parallax"],
  ["PLUGIN", "STL Tones", "Tonehub"], ["PLUGIN", "Positive Grid", "BIAS FX 2"], ["PLUGIN", "IK Multimedia", "AmpliTube 5"],
  ["PLUGIN", "Native Instruments", "Guitar Rig 7"], ["PLUGIN", "Line 6", "Helix Native"], ["PLUGIN", "Universal Audio", "Marshall Plexi Super Lead 1959"],
  ["PLUGIN", "ML Sound Lab", "Amped Roots"], ["PLUGIN", "Kuassa", "Amplifikation Vermilion"], ["PLUGIN", "Two Notes", "Genome"],
];

const slug = (brand: string, model: string) =>
  `${brand} ${model}`.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export async function seedGear(prisma: PrismaClient) {
  for (const [kind, brand, model, controls] of GEAR) {
    const s = slug(brand, model);
    await prisma.gearItem.upsert({
      where: { slug: s },
      create: { slug: s, kind, brand, model, controls: controls ?? [], status: "APPROVED" },
      update: { kind, brand, model, ...(controls && { controls }) },
    });
  }
}
