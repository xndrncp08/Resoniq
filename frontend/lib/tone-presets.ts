import type { BlockCategory } from "@/types/rig";

/**
 * Resoniq-generated tone presets: suggested starting settings, written as
 * data and turned into drafts by lib/tone-drafts.ts. Nothing here comes from
 * a recording or a test of the gear; every tone published from it carries the
 * "Resoniq-generated" label and GENERATED_DISCLOSURE.
 *
 * Gear is referenced by catalog slug (prisma/seed-gear.ts) so tones link to
 * gear pages; anything outside the catalog is named as custom gear. Amp
 * settings use each amp's real panel controls on its 0–10 scale. Pedal knobs
 * are 0–10 (≈ clock position: 5 is noon); times are in ms; switches are labels.
 * Artist names describe a style a tone is inspired by, never an endorsement.
 */

/** A catalog item by slug, or custom gear by name. */
export type PresetGear = { slug: string } | { brand?: string; model: string };

export type PresetBlock = {
  category: BlockCategory;
  gear?: PresetGear;
  params: Record<string, number | string>;
  placement?: "pre" | "loop";
  enabled?: boolean;
};

export type TonePreset = {
  key: string;
  name: string;
  instrument: "GUITAR" | "BASS";
  /** From TONE_GENRES (lib/tones.ts). */
  genres: string[];
  styles: string[];
  description: string;
  player: { gear: PresetGear; pickups: string[]; pickupPosition: string; strings?: string; tuning?: string };
  amp: { gear: PresetGear; channel?: string; settings: Record<string, number> };
  cab: { gear?: PresetGear; speakers?: string; mic?: string };
  chain: PresetBlock[];
  eq?: Record<string, number>;
  /** How to play it (rig notes). */
  playing: string;
  /** Step-by-step setup (rig setup guide). */
  setup: string;
  alternatives: string[];
  artists?: string[];
};

const g = (slug: string): PresetGear => ({ slug });
const custom = (brand: string, model: string): PresetGear => ({ brand, model });

export const TONE_PRESETS: TonePreset[] = [
  // ── Ambient worship ────────────────────────────────────────────────
  {
    key: "ambient-worship-swells",
    name: "Ambient Worship Swells",
    instrument: "GUITAR",
    genres: ["worship", "ambient"],
    styles: ["volume swells", "pads", "dotted eighth"],
    description: "A wide, washy clean-to-edge pad for slow worship sets: a low-gain drive for sustain, a dotted-eighth delay and a long shimmer reverb that fills the space between chords.",
    player: { gear: g("fender-player-telecaster"), pickups: ["Alnico V single coils"], pickupPosition: "Neck", strings: "10–46" },
    amp: { gear: g("vox-ac30"), channel: "Top Boost", settings: { Volume: 4, Treble: 5.5, Bass: 5, "Tone Cut": 4, Master: 6 } },
    cab: { speakers: "2×12 Celestion Alnico Blue", mic: "SM57 at the cap edge, 2 in back" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 4, Blend: 4, Tone: 5 } },
      { category: "drive", gear: g("jhs-morning-glory"), params: { Volume: 6, Drive: 3, Tone: 5, "Gain switch": "Low" } },
      { category: "volume", gear: custom("Ernie Ball", "VP Jr volume pedal"), params: { Taper: "Low" } },
      { category: "delay", gear: g("strymon-timeline"), params: { Mode: "dTape", "Time (ms)": 450, Subdivision: "Dotted 8th", Repeats: 4, Mix: 4 } },
      { category: "reverb", gear: g("strymon-bigsky"), params: { Program: "Shimmer", Decay: 7, Mix: 4, Tone: 4, "Pitch voice": "+1 octave" } },
    ],
    playing: "Roll the volume pedal off, pick the chord, then swell in over half a beat. Let notes ring and avoid busy strumming: the delay and reverb do the rhythm. Neck pickup with the tone knob around 7 keeps the shimmer from getting glassy.",
    setup: "1. Set the AC30 just clean at your stage volume.\n2. Add the compressor with blend around 9 o'clock so attacks stay natural.\n3. Morning Glory on low gain, set so it's a little louder than bypass.\n4. Tap the delay to the song tempo (dotted eighth).\n5. Add the shimmer last and back the mix off until it sits behind the vocal.",
    alternatives: ["Fender Deluxe Reverb instead of the AC30", "Boss DD-8 in tap mode for the delay", "TC Electronic Hall of Fame 2 (Shimmer TonePrint) for the reverb", "Line 6 HX Stomp with Vintage Digital delay and Plateaux reverb"],
  },
  {
    key: "worship-dotted-eighth-lead",
    name: "Dotted-Eighth Worship Lead",
    instrument: "GUITAR",
    genres: ["worship", "rock"],
    styles: ["dotted eighth", "lead lines", "edge of breakup"],
    description: "A lead voice for melodic hooks over a full band: transparent overdrive into an edge-of-breakup amp, a dotted-eighth delay that turns single notes into arpeggios, and a medium hall.",
    player: { gear: g("prs-silver-sky"), pickups: ["635JM single coils"], pickupPosition: "Bridge/Middle", strings: "10–46" },
    amp: { gear: g("fender-deluxe-reverb"), settings: { Volume: 5, Treble: 6, Middle: 5, Bass: 4, Reverb: 2 } },
    cab: { speakers: "1×12 Jensen C12K", mic: "SM57 slightly off-axis" },
    chain: [
      { category: "boost", gear: g("wampler-tumnus"), params: { Gain: 3, Treble: 5.5, Output: 7 } },
      { category: "drive", gear: g("ibanez-ts9-tube-screamer"), params: { Drive: 4, Tone: 5.5, Level: 6 }, enabled: false },
      { category: "delay", gear: g("mxr-carbon-copy"), params: { Regen: 3.5, Mix: 4.5, "Delay (ms)": 375, Mod: "On" } },
      { category: "reverb", gear: g("tc-electronic-hall-of-fame-2"), params: { Type: "Hall", Decay: 5, Level: 4, Tone: 5 } },
    ],
    playing: "Play eighth-note melodies on one or two strings and let the dotted-eighth repeats fill in between. Mute cleanly between phrases. Kick the TS9 on top of the Tumnus for the last chorus.",
    setup: "1. Set the Deluxe so a hard pick attack just breaks up.\n2. Tumnus as an always-on boost, a touch louder than bypass.\n3. Set the Carbon Copy delay to a dotted eighth of the song tempo (375 ms ≈ 120 BPM).\n4. Keep the hall mix low; the delay already adds width.",
    alternatives: ["Klon Centaur or any Klon-style boost instead of the Tumnus", "Boss DD-8 (tap tempo) instead of the Carbon Copy", "Fender American Professional II Stratocaster, position 4"],
  },

  // ── John Mayer-inspired blues ─────────────────────────────────────
  {
    key: "mayer-inspired-neck-blues",
    name: "Neck-Pickup Blues (Mayer-Inspired)",
    instrument: "GUITAR",
    genres: ["blues", "pop"],
    styles: ["neck pickup", "edge of breakup", "stacked drives"],
    description: "A warm, vocal neck-pickup blues lead in the spirit of John Mayer's live trio tones: a clean, headroom-heavy amp pushed by a mid-hump overdrive, with a Klon-style boost stacked in front for solos.",
    player: { gear: g("fender-american-professional-ii-stratocaster"), pickups: ["V-Mod II single coils"], pickupPosition: "Neck", strings: "11–49" },
    amp: { gear: g("two-rock-classic-reverb-signature"), channel: "Clean, bright off", settings: { Gain: 4, Bass: 4.5, Middle: 6, Treble: 5, Presence: 4, Master: 5 } },
    cab: { speakers: "2×12 open back", mic: "Ribbon mic 6 in back, slightly off-centre" },
    chain: [
      { category: "drive", gear: g("ibanez-ts808-tube-screamer"), params: { Drive: 3, Tone: 5, Level: 7 } },
      { category: "boost", gear: g("klon-centaur"), params: { Gain: 2.5, Treble: 5, Output: 6 }, enabled: false },
      { category: "reverb", gear: custom("Fender", "'63 Reverb (spring)"), params: { Dwell: 4, Mix: 3, Tone: 5 }, placement: "loop" },
    ],
    playing: "Neck pickup, tone knob around 6. Play with your fingers or a light pick, lean into bends, and use dynamics: dig in for grit, back off for clean. Engage the boost for the second solo only.",
    setup: "1. Set the amp clean and loud with the bright switch off.\n2. TS808 low drive and high level so it pushes the amp rather than distorting by itself.\n3. Stack the Klon-style boost with low gain for the solo lift.\n4. Spring reverb just audible.",
    alternatives: ["Fender Twin Reverb or Deluxe Reverb instead of the Two-Rock", "Dumble Overdrive Special (catalog) if you have access to one", "Ibanez TS9 instead of the TS808", "PRS Silver Sky, neck pickup"],
    artists: ["John Mayer"],
  },
  {
    key: "mayer-inspired-position-four-clean",
    name: "Position-Four Clean Funk-Blues (Mayer-Inspired)",
    instrument: "GUITAR",
    genres: ["blues", "pop", "funk"],
    styles: ["quack", "compressed clean", "rhythm"],
    description: "A glassy, compressed in-between clean for rhythm parts and double-stops, inspired by the studio clean tones John Mayer uses on pop-blues songs: position 4 on a Strat, light compression and a big clean amp.",
    player: { gear: g("prs-silver-sky"), pickups: ["635JM single coils"], pickupPosition: "Neck/Middle", strings: "10–46" },
    amp: { gear: g("fender-twin-reverb"), channel: "Vibrato, bright off", settings: { Volume: 3.5, Treble: 6, Middle: 4.5, Bass: 4, Reverb: 2.5 } },
    cab: { speakers: "2×12 Jensen C12K", mic: "SM57 on the cone edge" },
    chain: [
      { category: "compressor", gear: g("mxr-dyna-comp"), params: { Output: 6, Sensitivity: 3.5 } },
      { category: "delay", gear: g("boss-dd-8-digital-delay"), params: { "E.Level": 2.5, "F.Back": 2, "Time (ms)": 280, Mode: "Analog" } },
    ],
    playing: "Fingers or a light pick, muting with the fretting hand for percussive sixteenths. Double-stops and hammer-ons around the root shape sound best here.",
    setup: "1. Set the Twin clean with plenty of headroom.\n2. Dyna Comp with low sensitivity so it evens out the attack without squash.\n3. Short slapback-ish delay, barely audible.",
    alternatives: ["Fender Deluxe Reverb", "Keeley Compressor Plus at blend 50%", "Fender American Professional II Stratocaster, position 4"],
    artists: ["John Mayer"],
  },

  // ── Vintage Fender cleans ─────────────────────────────────────────
  {
    key: "blackface-twin-clean",
    name: "Blackface Twin Clean",
    instrument: "GUITAR",
    genres: ["country", "pop", "rock"],
    styles: ["sparkling clean", "spring reverb"],
    description: "The classic big-headroom Fender clean: bright, scooped, with deep spring reverb. A starting point for country, pop and clean rock rhythm.",
    player: { gear: g("fender-american-professional-ii-stratocaster"), pickups: ["V-Mod II single coils"], pickupPosition: "Middle", strings: "10–46" },
    amp: { gear: g("fender-twin-reverb"), channel: "Normal, bright on", settings: { Volume: 3, Treble: 6.5, Middle: 4, Bass: 3.5, Reverb: 3.5 } },
    cab: { speakers: "2×12 Jensen C12K", mic: "SM57 halfway between cap and edge" },
    chain: [{ category: "compressor", gear: g("mxr-dyna-comp"), params: { Output: 5, Sensitivity: 3 }, enabled: false }],
    playing: "Strum open chords or arpeggiate; the amp stays clean even when you dig in. Turn the reverb up for surf, down for country.",
    setup: "1. Bright switch on, volume low enough that it never breaks up.\n2. Scoop the mids a little, bass under the treble.\n3. Spring reverb to taste; it's the amp's own.\n4. Compressor optional for chicken-picking.",
    alternatives: ["Fender Deluxe Reverb", "Roland JC-120 Jazz Chorus for an even cleaner, flatter clean", "Universal Audio Dream '65 Reverb Amplifier pedal into a flat clean amp"],
  },
  {
    key: "tweed-bassman-edge",
    name: "Tweed Bassman Edge-of-Breakup",
    instrument: "GUITAR",
    genres: ["blues", "rock", "country"],
    styles: ["edge of breakup", "dynamic", "touch sensitive"],
    description: "A gritty, touch-sensitive tweed tone: a Bassman-style amp turned up until it just breaks up, cleaning up with the guitar's volume knob. No pedals required.",
    player: { gear: g("fender-player-telecaster"), pickups: ["Alnico V single coils"], pickupPosition: "Bridge", strings: "10–46" },
    amp: { gear: g("fender-bassman-5f6-a"), channel: "Bright channel", settings: { Presence: 5, Middle: 6, Bass: 3, Treble: 6, Volume: 6 } },
    cab: { gear: g("jensen-c12n-speaker"), speakers: "4×10 Jensen P10R (or C12N in a 1×12)", mic: "SM57 at the cap, 1 in back" },
    chain: [],
    playing: "Use the guitar's volume knob as the gain control: 10 for crunch, 7 for clean. Hybrid picking on the bridge pickup gets the snap.",
    setup: "1. Keep bass low: tweed circuits get flubby fast.\n2. Raise volume until a hard strum breaks up but soft picking stays clean.\n3. Presence at noon; add more if the Tele sounds dull.",
    alternatives: ["Fender Deluxe Reverb with volume past 5", "Fender Bassman 4×10 cab", "Fulltone OCD on low gain into a clean amp"],
  },
  {
    key: "jaguar-surf-clean",
    name: "Vintage Offset Surf Clean",
    instrument: "GUITAR",
    genres: ["indie", "rock"],
    styles: ["surf", "spring reverb", "tremolo"],
    description: "Bright, splashy offset clean with lots of spring reverb and a little tremolo, for surf lines and jangly indie parts.",
    player: { gear: g("fender-jaguar"), pickups: ["Jaguar single coils"], pickupPosition: "Bridge", strings: "11–50 (heavier for the short scale)" },
    amp: { gear: g("fender-deluxe-reverb"), channel: "Vibrato", settings: { Volume: 3.5, Treble: 6.5, Middle: 4, Bass: 4, Reverb: 6 } },
    cab: { speakers: "1×12 Jensen C12K", mic: "SM57 on axis" },
    chain: [
      { category: "tremolo", gear: custom("Fender", "amp vibrato (built in)"), params: { Speed: 5, Intensity: 3 } },
      { category: "reverb", gear: g("universal-audio-dream-65-reverb-amplifier"), params: { Reverb: 6, Mode: "Spring" }, enabled: false },
    ],
    playing: "Pick hard near the bridge for the drip; tremolo-picked single-note lines are the classic move. The rhythm circuit gives a darker preset for verses.",
    setup: "1. Reverb high (the amp's spring tank).\n2. Volume low so it stays clean.\n3. Built-in vibrato slow and shallow.\n4. The Dream '65 pedal is an option for non-Fender amps.",
    alternatives: ["Fender Jazzmaster", "Fender Twin Reverb", "Boss RV-6 in Spring mode"],
  },

  // ── Classic rock crunch ──────────────────────────────────────────
  {
    key: "plexi-classic-crunch",
    name: "Plexi Classic Rock Crunch",
    instrument: "GUITAR",
    genres: ["rock", "blues"],
    styles: ["crunch", "power chords", "cranked amp"],
    description: "A cranked non-master-volume Plexi into greenbacks: open, chewy crunch for riffs and power chords, with jumped channels for body.",
    player: { gear: g("gibson-les-paul-standard-50s"), pickups: ["Burstbucker 1 & 2 humbuckers"], pickupPosition: "Bridge", strings: "10–46" },
    amp: { gear: g("marshall-1959slp-plexi"), channel: "Channels jumped", settings: { Presence: 5, Bass: 4, Middle: 7, Treble: 6, "Volume I": 6, "Volume II": 4 } },
    cab: { gear: g("marshall-1960a-4x12"), speakers: "4×12 Celestion G12M Greenback", mic: "SM57 at the cap edge" },
    chain: [{ category: "boost", gear: g("ibanez-ts808-tube-screamer"), params: { Drive: 1, Tone: 6, Level: 8 }, enabled: false }],
    playing: "Let open chords ring and palm-mute the low strings for chug. For solos, kick the TS808 as a clean boost rather than adding more amp gain.",
    setup: "1. Jumper the channels (Normal + High Treble).\n2. Bright volume above normal volume.\n3. Mids high: this tone lives in the mids.\n4. Use an attenuator if the amp has to be this loud at home.",
    alternatives: ["Marshall JVM410H on the Crunch channel", "Friedman BE-100", "Celestion Vintage 30 speakers for a tighter top end"],
  },
  {
    key: "jcm800-rhythm-crunch",
    name: "JCM800 Rock Rhythm",
    instrument: "GUITAR",
    genres: ["rock", "metal"],
    styles: ["crunch", "80s rock", "boosted"],
    description: "Tight, bright 80s rock rhythm: a JCM800 with a Tube Screamer boost in front, for power chords and palm-muted eighths.",
    player: { gear: g("gibson-sg-standard"), pickups: ["490R/490T humbuckers"], pickupPosition: "Bridge", strings: "10–46" },
    amp: { gear: g("marshall-jcm800-2203"), settings: { Gain: 7, Bass: 4.5, Middle: 6, Treble: 6, Presence: 5.5, Master: 4 } },
    cab: { gear: g("marshall-1960a-4x12"), speakers: "4×12 Celestion G12T-75", mic: "SM57 1 in off the cap" },
    chain: [
      { category: "boost", gear: g("ibanez-ts9-tube-screamer"), params: { Drive: 1, Tone: 5.5, Level: 8 } },
      { category: "phaser", gear: g("mxr-phase-90"), params: { Speed: 3 }, enabled: false },
      { category: "delay", gear: g("boss-dd-8-digital-delay"), params: { "E.Level": 3, "F.Back": 3, "Time (ms)": 420 }, placement: "loop", enabled: false },
    ],
    playing: "Palm-mute eighth notes on the low strings and open up on choruses. Phase 90 at a slow speed for solos.",
    setup: "1. TS9 with drive near zero and level high tightens the low end.\n2. Amp gain around 7.\n3. Delay in the effects loop for leads only.",
    alternatives: ["Marshall JVM410H (Crunch channel)", "Boss SD-1 instead of the TS9", "Epiphone Les Paul Standard"],
  },

  // ── Modern metal rhythm ──────────────────────────────────────────
  {
    key: "modern-metal-rhythm-5150",
    name: "Modern Metal Rhythm (Tight 5150)",
    instrument: "GUITAR",
    genres: ["metal"],
    styles: ["drop tuning", "palm mute", "tight"],
    description: "A tight, aggressive modern metal rhythm: a boosted 5150-style high-gain channel, a noise gate and Vintage 30s, tuned to drop C.",
    player: { gear: g("esp-e-ii-eclipse"), pickups: ["EMG 81 (bridge)", "EMG 60 (neck)"], pickupPosition: "Bridge", strings: "11–56", tuning: "Drop C" },
    amp: { gear: g("evh-5150iii-50w"), channel: "Red (channel 3)", settings: { Gain: 5.5, Bass: 4.5, Middle: 5.5, Treble: 6, Presence: 5, Master: 4 } },
    cab: { gear: g("mesa-boogie-rectifier-4x12"), speakers: "4×12 Celestion Vintage 30", mic: "SM57 at the cap edge + MD421 blended low" },
    chain: [
      { category: "boost", gear: g("ibanez-ts9-tube-screamer"), params: { Drive: 0, Tone: 6, Level: 8 } },
      { category: "gate", gear: g("isp-decimator-ii"), params: { Threshold: 4 } },
    ],
    eq: { "80Hz": -2, "500Hz": -1, "4kHz": 1.5 },
    playing: "Alternate-pick palm-muted chugs on the low string; keep the right hand tight and muted. Less amp gain than you think keeps chords clear.",
    setup: "1. TS9 drive at 0, level high: it cuts low end before the amp.\n2. Amp gain around 5–6; raise only if riffs feel weak.\n3. Gate just above the noise floor so sustained chords still decay naturally.",
    alternatives: ["Peavey 6505+", "Mesa/Boogie Dual Rectifier (Modern mode)", "Neural DSP Archetype: Gojira", "Boss NS-2 instead of the Decimator"],
  },
  {
    key: "modern-metal-7-string-djent",
    name: "Seven-String Djent Rhythm",
    instrument: "GUITAR",
    genres: ["metal", "prog"],
    styles: ["djent", "extended range", "tight gate"],
    description: "A percussive extended-range rhythm with a very tight low end and gated stops: boosted modern high gain on a seven-string with active-style pickups.",
    player: { gear: g("strandberg-boden-original-7"), pickups: ["Fishman Fluence Modern 7"], pickupPosition: "Bridge", strings: "10–59", tuning: "Drop A (A E A D G B E)" },
    amp: { gear: g("diezel-vh4"), channel: "Channel 3", settings: { Gain: 5, Bass: 3.5, Middle: 6, Treble: 6.5, Presence: 6, Master: 4 } },
    cab: { gear: g("mesa-boogie-rectifier-4x12"), speakers: "4×12 Celestion Vintage 30", mic: "SM57 at the cap" },
    chain: [
      { category: "boost", gear: g("ibanez-ts808-tube-screamer"), params: { Drive: 0, Tone: 6.5, Level: 9 } },
      { category: "gate", gear: g("isp-decimator-ii"), params: { Threshold: 5.5 } },
    ],
    eq: { "100Hz": -3, "2.5kHz": 1 },
    playing: "Syncopated palm-muted single-note rhythms on the low string with hard stops. The gate should cut silence instantly between hits.",
    setup: "1. Bass on the amp low: extended-range low end is mostly mud above 100 Hz.\n2. Overdrive as a tight boost.\n3. Gate threshold just high enough that stops are silent.",
    alternatives: ["Neural DSP Archetype: Plini (for cleaner prog parts)", "Peavey 6505+", "Ibanez RG with DiMarzio pickups, tuned down"],
  },

  // ── High-gain lead ────────────────────────────────────────────────
  {
    key: "high-gain-singing-lead",
    name: "Singing High-Gain Lead",
    instrument: "GUITAR",
    genres: ["rock", "metal"],
    styles: ["lead", "sustain", "legato"],
    description: "A smooth, singing lead with long sustain: a boosted Soldano-style lead channel, a touch of delay and a big plate reverb for legato solos.",
    player: { gear: g("ibanez-rg550"), pickups: ["DiMarzio Tone Zone (bridge)"], pickupPosition: "Bridge", strings: "10–46" },
    amp: { gear: g("soldano-slo-100"), channel: "Overdrive", settings: { Gain: 6.5, Bass: 4.5, Middle: 7, Treble: 5.5, Presence: 4.5, Master: 4 } },
    cab: { gear: g("marshall-1960a-4x12"), speakers: "4×12 Celestion Vintage 30", mic: "SM57 just off the cap" },
    chain: [
      { category: "boost", gear: g("ibanez-ts808-tube-screamer"), params: { Drive: 2, Tone: 5, Level: 7 } },
      { category: "delay", gear: g("mxr-carbon-copy"), params: { Regen: 3, Mix: 3.5, "Delay (ms)": 450 }, placement: "loop" },
      { category: "reverb", gear: g("tc-electronic-hall-of-fame-2"), params: { Type: "Plate", Decay: 6, Level: 3 }, placement: "loop" },
    ],
    playing: "Legato runs and wide vibrato on the B and G strings. Mute unused strings with both hands: high gain amplifies every noise.",
    setup: "1. Mids high so leads cut through.\n2. TS808 adds focus and sustain.\n3. Delay and reverb after the amp so they stay clean behind the distortion.",
    alternatives: ["Bogner Ecstasy (red channel)", "Mesa/Boogie Mark V (channel 3)", "Seymour Duncan JB SH-4 in the bridge"],
  },
  {
    key: "high-gain-mark-lead",
    name: "Mark-Style Fusion-Metal Lead",
    instrument: "GUITAR",
    genres: ["metal", "prog", "rock"],
    styles: ["lead", "V-shaped EQ", "tight"],
    description: "A focused, articulate lead with a classic V-shaped graphic EQ: tight enough for fast picking, warm enough for melodic phrases.",
    player: { gear: g("music-man-jp15"), pickups: ["DiMarzio Sustain Block / Illuminator-style humbuckers"], pickupPosition: "Bridge", strings: "10–52" },
    amp: { gear: g("mesa-boogie-mark-v"), channel: "Channel 3, Mark IIC+ mode", settings: { Gain: 6, Bass: 1.5, Middle: 6, Treble: 7, Presence: 5, Master: 4 } },
    cab: { speakers: "4×12 Celestion Vintage 30", mic: "SM57 at the cap edge" },
    chain: [
      { category: "eq", gear: custom("Mesa/Boogie", "Mark V 5-band graphic EQ (built in)"), params: { "80Hz": 6, "240Hz": 5, "750Hz": 3.5, "2200Hz": 5.5, "6600Hz": 6 } },
      { category: "delay", gear: g("boss-dd-8-digital-delay"), params: { "E.Level": 3, "F.Back": 3.5, "Time (ms)": 400 }, placement: "loop" },
    ],
    playing: "Alternate-picked runs and sweeps stay clear with this low-bass setting. Back off the guitar volume slightly for rhythm.",
    setup: "1. Keep amp bass very low: Mark circuits get boomy fast.\n2. Pull the 750 Hz slider down slightly for the classic V.\n3. Delay in the loop.",
    alternatives: ["A Neural DSP Archetype plugin with a Mark-style lead amp", "Boss Katana-100 MkII with a Lead preset and graphic EQ", "PRS Custom 24"],
  },

  // ── Funk rhythm ───────────────────────────────────────────────────
  {
    key: "funk-strat-quack",
    name: "Funk Rhythm Quack",
    instrument: "GUITAR",
    genres: ["funk", "pop"],
    styles: ["sixteenth-note rhythm", "compressed clean", "chicken scratch"],
    description: "A bright, percussive funk rhythm: in-between single coils, firm compression and a pristine clean amp, with an optional wah for sixteenth-note scratching.",
    player: { gear: g("fender-american-professional-ii-stratocaster"), pickups: ["V-Mod II single coils"], pickupPosition: "Bridge/Middle", strings: "10–46" },
    amp: { gear: g("roland-jc-120-jazz-chorus"), channel: "Channel 2", settings: { Volume: 4, Treble: 6, Middle: 5, Bass: 4, Distortion: 0, Reverb: 1.5 } },
    cab: { speakers: "2×12 JC speakers", mic: "SM57 on axis" },
    chain: [
      { category: "compressor", gear: g("mxr-dyna-comp"), params: { Output: 6, Sensitivity: 5 } },
      { category: "wah", gear: g("dunlop-cry-baby-gcb95"), params: { Position: "Rocked with the rhythm" }, enabled: false },
    ],
    playing: "Sixteenth-note strumming with the fretting hand muting most strokes; only a few accents ring. Play near the bridge, small chord shapes on the top four strings.",
    setup: "1. Amp totally clean, chorus off.\n2. Compressor sensitivity at noon for snap.\n3. Wah only when the groove calls for it.",
    alternatives: ["Fender Twin Reverb", "Keeley Compressor Plus", "PRS Silver Sky, position 4"],
  },
  {
    key: "funk-envelope-filter",
    name: "Envelope-Filter Funk",
    instrument: "GUITAR",
    genres: ["funk"],
    styles: ["auto-wah", "envelope filter", "single-note riffs"],
    description: "A squelchy, vocal auto-wah for single-note funk riffs: an envelope filter driven by pick attack, into a clean amp.",
    player: { gear: g("fender-player-telecaster"), pickups: ["Alnico V single coils"], pickupPosition: "Neck", strings: "10–46" },
    amp: { gear: g("fender-twin-reverb"), settings: { Volume: 3, Treble: 5.5, Middle: 5, Bass: 4, Reverb: 1.5 } },
    cab: { speakers: "2×12 Jensen C12K", mic: "SM57 on axis" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 5, Blend: 6, Tone: 5.5 } },
      { category: "filter", gear: custom("Musitronics", "Mu-Tron III-style envelope filter"), params: { Mode: "LP, up sweep", Peak: 6, Gain: 5, Range: "Low" } },
    ],
    playing: "Pick harder for a wider sweep, softer for a subtle quack. Short staccato single-note riffs on the low strings work best.",
    setup: "1. Compressor first so the filter sweeps evenly.\n2. Filter sensitivity so a medium attack opens it most of the way.\n3. Clean amp with lots of headroom.",
    alternatives: ["Line 6 HX Stomp (Mutant Filter)", "Chase Bliss Mood MkII for weirder textures", "Dunlop Cry Baby as a manual alternative"],
  },

  // ── Jazz guitar ───────────────────────────────────────────────────
  {
    key: "jazz-semi-hollow-warm",
    name: "Warm Semi-Hollow Jazz",
    instrument: "GUITAR",
    genres: ["jazz"],
    styles: ["chord melody", "flatwounds", "warm clean"],
    description: "A round, dark jazz clean for comping and chord-melody: neck humbucker with the tone rolled back, flatwound strings and a flat clean amp.",
    player: { gear: g("gibson-es-335"), pickups: ["Calibrated T-Type humbuckers"], pickupPosition: "Neck", strings: "12–52 flatwounds" },
    amp: { gear: g("roland-jc-120-jazz-chorus"), channel: "Channel 1", settings: { Volume: 3.5, Treble: 3.5, Middle: 6, Bass: 5.5, Distortion: 0, Reverb: 2 } },
    cab: { speakers: "2×12 JC speakers", mic: "Ribbon mic 8 in back" },
    chain: [],
    playing: "Pick with the flesh of the thumb or a heavy pick near the neck. Guitar tone knob around 3–4. Comp with shell voicings; let chord-melody lines breathe.",
    setup: "1. Treble low, mids up on the amp.\n2. No effects; a little of the amp's reverb.\n3. Flatwounds make the biggest single difference.",
    alternatives: ["Fender Twin Reverb with treble at 3", "Gretsch G6120 Chet Atkins (neck)", "Any archtop with a floating humbucker"],
  },
  {
    key: "jazz-fusion-lead",
    name: "Smooth Fusion Lead",
    instrument: "GUITAR",
    genres: ["jazz", "prog"],
    styles: ["fusion", "legato", "light overdrive"],
    description: "A smooth, slightly compressed fusion lead with a touch of overdrive, chorus-like delay modulation and a warm reverb for flowing legato lines.",
    player: { gear: g("prs-custom-24"), pickups: ["85/15 humbuckers"], pickupPosition: "Neck", strings: "10–46" },
    amp: { gear: g("fender-deluxe-reverb"), settings: { Volume: 4.5, Treble: 5, Middle: 6, Bass: 4.5, Reverb: 2 } },
    cab: { speakers: "1×12 Jensen C12K", mic: "SM57 off-axis" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 5, Blend: 5, Tone: 5 } },
      { category: "drive", gear: g("ibanez-ts808-tube-screamer"), params: { Drive: 4, Tone: 4.5, Level: 6 } },
      { category: "delay", gear: g("mxr-carbon-copy"), params: { Regen: 3, Mix: 3, "Delay (ms)": 380, Mod: "On" } },
    ],
    playing: "Legato phrasing with hammer-ons and pull-offs; roll the guitar volume back to 8 for a rounder attack.",
    setup: "1. Compression adds sustain without more gain.\n2. TS808 with the tone below noon to keep it smooth.\n3. Modulated delay adds width without a chorus pedal.",
    alternatives: ["Boss Katana-100 MkII (Crunch channel)", "Two-Rock Classic Reverb Signature", "Ibanez AZ2402"],
  },

  // ── Slap bass ─────────────────────────────────────────────────────
  {
    key: "slap-bass-stingray",
    name: "Modern Slap Bass",
    instrument: "BASS",
    genres: ["funk", "pop"],
    styles: ["slap", "pop", "scooped"],
    description: "A punchy, scooped slap tone: active humbucker bass, firm compression and a clean, full-range amp with the low and high ends lifted.",
    player: { gear: g("music-man-stingray-4"), pickups: ["Active humbucker (3-band preamp)"], pickupPosition: "Bridge", strings: "45–105 roundwounds" },
    amp: { gear: g("markbass-little-mark-iv"), settings: { Gain: 4.5, Low: 6.5, Mid: 4, High: 6.5, Master: 5 } },
    cab: { speakers: "2×10 neo with tweeter", mic: "DI from the amp, post-EQ" },
    chain: [{ category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5.5, Sustain: 5.5, Blend: 7, Tone: 6 } }],
    eq: { "60Hz": 2, "500Hz": -3, "4kHz": 2 },
    playing: "Thumb slaps on the E and A strings with the side of the thumb, pops with the index finger on D and G. Mute ghost notes with the fretting hand.",
    setup: "1. Bass preamp: treble and bass slightly up, mids flat.\n2. Compressor fast enough to tame pops without killing the snap.\n3. Amp EQ scooped around 500 Hz.",
    alternatives: ["Fender Jazz Bass, both pickups full", "MXR Dyna Comp (less ideal on bass)", "Darkglass Microtubes 900 v2 clean"],
  },
  {
    key: "slap-bass-jazz-bridge",
    name: "Jazz Bass Slap & Pop",
    instrument: "BASS",
    genres: ["funk", "rock"],
    styles: ["slap", "passive bass", "DI grit"],
    description: "Passive jazz bass with both pickups wide open, a DI-style preamp for growl and a compressor for even pops.",
    player: { gear: g("fender-jazz-bass"), pickups: ["Passive single coils"], pickupPosition: "Neck/Bridge (both full)", strings: "45–100 stainless roundwounds" },
    amp: { gear: g("ampeg-svt-cl"), settings: { Gain: 4, Bass: 5.5, Midrange: 4, Treble: 6, Master: 4 } },
    cab: { gear: g("ampeg-svt-810e"), speakers: "8×10", mic: "DI from the pedal plus a mic blended low" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 5, Blend: 6, Tone: 5.5 } },
      { category: "amp-sim", gear: g("tech-21-sansamp-bass-driver-di"), params: { Level: 5, Blend: 4, Treble: 6, Bass: 5.5, Presence: 5, Drive: 3 } },
    ],
    playing: "Both pickups at full for the classic hollow mid scoop. Slap near the end of the neck; pop with a hooked index finger.",
    setup: "1. Sansamp blend under halfway so grit stays in the background.\n2. Compressor before the Sansamp.\n3. Amp mids slightly cut.",
    alternatives: ["Sire Marcus Miller V7", "Markbass Little Mark IV", "Darkglass B7K Ultra on low drive"],
  },

  // ── Vintage fingerstyle bass ──────────────────────────────────────
  {
    key: "vintage-p-bass-thump",
    name: "Vintage Fingerstyle P-Bass Thump",
    instrument: "BASS",
    genres: ["rock", "pop", "funk"],
    styles: ["flatwounds", "fingerstyle", "vintage soul"],
    description: "Deep, round vintage thump: a P-bass with flatwounds and the tone rolled back, into a warm tube bass head. The classic 60s soul and rock sound.",
    player: { gear: g("fender-precision-bass"), pickups: ["Split single coil"], pickupPosition: "Middle", strings: "45–105 flatwounds" },
    amp: { gear: g("ampeg-svt-cl"), settings: { Gain: 4, Bass: 6, Midrange: 5.5, Treble: 3.5, Master: 4 } },
    cab: { gear: g("ampeg-svt-810e"), speakers: "8×10", mic: "Large-diaphragm mic 12 in back plus DI" },
    chain: [],
    playing: "Fingerstyle near the neck end of the pickup, tone knob around 4. Short, muted notes and walking lines; let the flats do the work.",
    setup: "1. Treble low on the amp.\n2. Mids at noon or slightly above.\n3. Tone rolled back on the bass. No effects.",
    alternatives: ["Fender Jazz Bass, neck pickup only", "Tech 21 SansAmp Bass Driver DI with drive at 0", "Foam mute under the bridge cover for a deader thump"],
  },
  {
    key: "vintage-ric-bass-pick",
    name: "Vintage Pick Bass Growl",
    instrument: "BASS",
    genres: ["rock", "prog", "indie"],
    styles: ["pick attack", "clanky", "growl"],
    description: "A clanky, mid-forward pick tone with a bit of tube growl: roundwound strings, bridge pickup and a driven tube head.",
    player: { gear: g("rickenbacker-4003"), pickups: ["High-gain single coils"], pickupPosition: "Bridge", strings: "45–105 roundwounds" },
    amp: { gear: g("ampeg-svt-cl"), settings: { Gain: 6, Bass: 5, Midrange: 6.5, Treble: 6, Master: 4 } },
    cab: { gear: g("ampeg-svt-810e"), speakers: "8×10", mic: "SM57 plus DI" },
    chain: [{ category: "amp-sim", gear: g("tech-21-sansamp-bass-driver-di"), params: { Level: 5, Blend: 6, Treble: 6, Bass: 5, Presence: 6, Drive: 5 } }],
    playing: "Pick downstrokes close to the bridge. Let the top end clank; it cuts through dense guitars.",
    setup: "1. More amp gain than usual for tube grind.\n2. Sansamp drive at noon, blend over halfway.\n3. Mids forward.",
    alternatives: ["Gibson Thunderbird", "Fender Precision Bass with a pick", "Darkglass B7K Ultra"],
  },

  // ── Modern progressive bass ───────────────────────────────────────
  {
    key: "prog-bass-dingwall-grind",
    name: "Modern Prog Bass Grind",
    instrument: "BASS",
    genres: ["prog", "metal"],
    styles: ["extended range", "parallel drive", "articulate"],
    description: "A modern, articulate prog-metal bass: multiscale five-string, parallel overdrive with a clean low end and a bright, grindy top for chords and fast picking.",
    player: { gear: g("dingwall-ng3"), pickups: ["Three FD3N pickups"], pickupPosition: "Bridge + Middle", strings: "45–130 (five string)", tuning: "Drop A (A D G C F) or standard B" },
    amp: { gear: g("darkglass-microtubes-900-v2"), settings: { Gain: 3, Bass: 5.5, "Low Mids": 4.5, "Hi Mids": 6, Treble: 6, Master: 5 } },
    cab: { speakers: "4×10 neo", mic: "DI from the amp" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 4.5, Blend: 6, Tone: 5 } },
      { category: "distortion", gear: g("darkglass-b7k-ultra"), params: { Level: 5, Blend: 5, Drive: 5.5, Bass: 5, "Lo Mids": 4.5, "Hi Mids": 6.5, Treble: 5.5 } },
      { category: "gate", gear: g("boss-ns-2-noise-suppressor"), params: { Threshold: 3, Decay: 4 } },
    ],
    playing: "Pick or fast two-finger playing; lock to the kick drum. The blend keeps the lows clean while the grit stays on top.",
    setup: "1. B7K blend at noon: clean lows, driven highs.\n2. Hi Mids up for articulation.\n3. Gate just enough to silence stops.",
    alternatives: ["Spector NS Dimension 5", "Tech 21 SansAmp Bass Driver DI", "Neural DSP Parallax plugin"],
  },
  {
    key: "prog-bass-spector-clean-chorus",
    name: "Prog Bass Clean with Chorus",
    instrument: "BASS",
    genres: ["prog", "ambient", "pop"],
    styles: ["chords", "chorus", "hi-fi clean"],
    description: "A hi-fi active clean for bass chords and melodic fills, with a subtle chorus on the top end and a compressor holding it together.",
    player: { gear: g("spector-ns-dimension-5"), pickups: ["Active humbuckers"], pickupPosition: "Neck + Bridge", strings: "45–130 (five string)" },
    amp: { gear: g("darkglass-microtubes-900-v2"), settings: { Gain: 2.5, Bass: 5, "Low Mids": 5, "Hi Mids": 5.5, Treble: 6, Master: 5 } },
    cab: { speakers: "2×12 neo", mic: "DI" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 5, Blend: 7, Tone: 5.5 } },
      { category: "chorus", gear: g("boss-ce-2w-chorus"), params: { Rate: 3, Depth: 4, Mode: "CE-2" } },
      { category: "reverb", gear: g("tc-electronic-hall-of-fame-2"), params: { Type: "Room", Decay: 3, Level: 2 } },
    ],
    playing: "Tap or fingerpick chords in the upper register; keep the low string for root notes. Light touch: active preamps reward it.",
    setup: "1. Compressor blend high for even chords.\n2. Chorus shallow so the low end stays centred.\n3. A small room reverb only.",
    alternatives: ["Ibanez SR500E", "Line 6 HX Stomp with a bass chorus and a crossover", "Walrus Audio Julia"],
  },

  // ── Ambient bass ─────────────────────────────────────────────────
  {
    key: "ambient-bass-octave-swells",
    name: "Ambient Bass Octave Swells",
    instrument: "BASS",
    genres: ["ambient", "worship"],
    styles: ["volume swells", "octave up", "pads"],
    description: "Pad-like bass swells for ambient and worship intros: an octave-up voice blended in, volume swells and a long reverb, with the fundamental kept clean.",
    player: { gear: g("ibanez-sr500e"), pickups: ["Bartolini humbuckers (active)"], pickupPosition: "Neck", strings: "45–105" },
    amp: { gear: g("markbass-little-mark-iv"), settings: { Gain: 3.5, Low: 5.5, Mid: 5, High: 5, Master: 5 } },
    cab: { speakers: "2×10 neo with tweeter", mic: "DI" },
    chain: [
      { category: "octave", gear: g("electro-harmonix-pog2"), params: { "Dry": 7, "+1 octave": 5, "Sub octave": 0, Attack: 6 } },
      { category: "volume", gear: custom("Ernie Ball", "VP Jr volume pedal"), params: { Taper: "Low" } },
      { category: "delay", gear: g("strymon-timeline"), params: { Mode: "Swell", "Time (ms)": 600, Repeats: 3, Mix: 3.5 } },
      { category: "reverb", gear: g("strymon-bigsky"), params: { Program: "Cloud", Decay: 8, Mix: 5, "Low end": "Cut" } },
    ],
    playing: "Hold notes high on the neck and swell them in with the volume pedal; double-stops (root and fifth) work well. Keep the low string out of the reverb tail.",
    setup: "1. POG2 attack slowed so notes fade in.\n2. Low-cut the reverb so the wash stays above the low end.\n3. Blend the dry signal high so the fundamental stays clean.",
    alternatives: ["Chase Bliss Mood MkII for glitchy textures", "TC Electronic Hall of Fame 2 (Shimmer)", "Fender Jazz Bass, neck pickup"],
  },

  // ── Indie / alternative ──────────────────────────────────────────
  {
    key: "indie-jangle-12-chime",
    name: "Indie Jangle Chime",
    instrument: "GUITAR",
    genres: ["indie", "pop"],
    styles: ["jangle", "arpeggios", "compressed clean"],
    description: "A bright, chiming jangle for arpeggiated indie parts: semi-hollow single coils, compression and a Top Boost amp just on the edge.",
    player: { gear: g("rickenbacker-330"), pickups: ["Hi-gain single coils"], pickupPosition: "Bridge/Middle (both)", strings: "10–46" },
    amp: { gear: g("vox-ac30"), channel: "Top Boost", settings: { Volume: 4.5, Treble: 6.5, Bass: 4, "Tone Cut": 3.5, Master: 6 } },
    cab: { speakers: "2×12 Celestion Alnico Blue", mic: "SM57 on axis at the cap" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 6, Blend: 6, Tone: 6 } },
      { category: "chorus", gear: g("walrus-audio-julia"), params: { Rate: 2.5, Depth: 3, Lag: 4, "D-P-V": 4, Mix: 3 }, enabled: false },
      { category: "reverb", gear: g("boss-rv-6-reverb"), params: { "E.Level": 3, Tone: 5, Time: 4, Mode: "Room" } },
    ],
    playing: "Arpeggiate open chords with a pick; let strings ring together. Light chorus adds a twelve-string shimmer.",
    setup: "1. Compressor sustain fairly high: jangle loves compression.\n2. AC30 just clean.\n3. Small room reverb.",
    alternatives: ["Fender Jazzmaster or Jaguar", "Fender Deluxe Reverb", "Boss CE-2W chorus"],
  },
  {
    key: "alt-rock-fuzz-wall",
    name: "Alt-Rock Fuzz Wall",
    instrument: "GUITAR",
    genres: ["indie", "rock", "shoegaze"],
    styles: ["fuzz", "wall of sound", "offset"],
    description: "A thick, saturated fuzz wall for big alt-rock choruses: a Big Muff into a dirty British amp, with a long reverb for shoegaze-adjacent washes.",
    player: { gear: g("fender-jazzmaster"), pickups: ["Wide-range single coils"], pickupPosition: "Bridge", strings: "11–50" },
    amp: { gear: g("orange-or15"), settings: { Gain: 4, Bass: 5, Middle: 5.5, Treble: 6, Presence: 5, Master: 5 } },
    cab: { gear: g("orange-ppc212"), speakers: "2×12 Celestion Vintage 30", mic: "SM57 at the cap edge" },
    chain: [
      { category: "fuzz", gear: g("electro-harmonix-big-muff-pi"), params: { Volume: 6, Tone: 5.5, Sustain: 7 } },
      { category: "fuzz", gear: g("death-by-audio-interstellar-overdriver"), params: { Level: 5, Drive: 6, Tone: 5 }, enabled: false },
      { category: "reverb", gear: g("strymon-bigsky"), params: { Program: "Bloom", Decay: 7, Mix: 3.5 }, placement: "loop" },
    ],
    playing: "Big open chords and slow strums; the fuzz sustains forever. Use the Jazzmaster's tremolo arm for subtle pitch bends on sustained chords.",
    setup: "1. Amp on the edge of breakup so the fuzz has a crunchy base.\n2. Big Muff tone at noon or slightly up so it doesn't vanish in the mix.\n3. Reverb in the loop for a cleaner tail.",
    alternatives: ["Fender Deluxe Reverb", "ProCo RAT 2 for a tighter alternative", "Fender Jaguar"],
  },

  // ── Acoustic-inspired electric ───────────────────────────────────
  {
    key: "acoustic-inspired-electric",
    name: "Acoustic-Inspired Electric Strum",
    instrument: "GUITAR",
    genres: ["pop", "worship", "country"],
    styles: ["acoustic simulation", "strumming", "compressed clean"],
    description: "An electric clean voiced like an acoustic: bass and low-mid cut, top end lifted, light compression and an acoustic simulator, for strummed parts when no acoustic is available.",
    player: { gear: g("fender-player-telecaster"), pickups: ["Alnico V single coils"], pickupPosition: "Neck", strings: "10–46" },
    amp: { gear: g("roland-jc-120-jazz-chorus"), channel: "Channel 1", settings: { Volume: 3.5, Treble: 6.5, Middle: 4.5, Bass: 3, Distortion: 0, Reverb: 2.5 } },
    cab: { speakers: "2×12 JC speakers", mic: "Condenser 12 in back, or DI" },
    chain: [
      { category: "compressor", gear: g("keeley-compressor-plus"), params: { Level: 5, Sustain: 4, Blend: 5, Tone: 6.5 } },
      { category: "eq", gear: custom("Boss", "AC-3 Acoustic Simulator"), params: { Mode: "Standard", Body: 5.5, Top: 6, Level: 5 } },
      { category: "chorus", gear: g("boss-ce-2w-chorus"), params: { Rate: 2, Depth: 2 }, enabled: false },
    ],
    eq: { "120Hz": -4, "300Hz": -2, "8kHz": 3 },
    playing: "Strum with a thin pick across all six strings. Open chords and capo shapes help it read as acoustic.",
    setup: "1. Cut lows and low mids hard; acoustics are thinner than electrics in a mix.\n2. Boost the top end with the EQ or amp treble.\n3. A light chorus suggests a twelve-string.",
    alternatives: ["Line 6 Helix Floor (acoustic sim block plus an acoustic IR)", "Ibanez AZ2402 with the neck single-coil split", "Taylor 814ce or Martin D-28 if you have the real thing"],
  },
  {
    key: "acoustic-inspired-fingerpicked",
    name: "Fingerpicked Piezo-Style Clean",
    instrument: "GUITAR",
    genres: ["ambient", "pop", "worship"],
    styles: ["fingerpicking", "acoustic simulation", "room reverb"],
    description: "A softer, fingerpicked acoustic-like clean: neck and middle single coils, gentle compression, a small room and a short delay for a close, intimate sound.",
    player: { gear: g("squier-classic-vibe-50s-stratocaster"), pickups: ["Alnico single coils"], pickupPosition: "Neck/Middle", strings: "10–46" },
    amp: { gear: g("fender-deluxe-reverb"), settings: { Volume: 3, Treble: 6, Middle: 5, Bass: 3.5, Reverb: 2 } },
    cab: { speakers: "1×12 Jensen C12K", mic: "Condenser 18 in back" },
    chain: [
      { category: "compressor", gear: g("mxr-dyna-comp"), params: { Output: 5, Sensitivity: 3 } },
      { category: "eq", gear: custom("Boss", "AC-3 Acoustic Simulator"), params: { Mode: "Piezo", Body: 4.5, Top: 6, Level: 5 } },
      { category: "delay", gear: g("boss-dd-8-digital-delay"), params: { "E.Level": 2, "F.Back": 1.5, "Time (ms)": 220 } },
      { category: "reverb", gear: g("boss-rv-6-reverb"), params: { "E.Level": 3, Tone: 6, Time: 3, Mode: "Room" } },
    ],
    playing: "Travis picking or arpeggios with the fingers; rest the palm lightly on the bridge for definition.",
    setup: "1. Low compression for evenness, not sustain.\n2. Acoustic sim in Piezo mode.\n3. Short delay and small room only.",
    alternatives: ["Yamaha Pacifica 112V", "Fender Twin Reverb", "Line 6 HX Stomp (acoustic sim)"],
  },
];
