/** Shared by profile editing, validation and musician discovery. */
export const INSTRUMENTS = [
  "electric-guitar", "acoustic-guitar", "bass", "extended-range", "keys", "drums", "vocals", "production",
  "percussion", "strings", "woodwinds", "brass", "dj", "other",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const INSTRUMENT_LABEL: Record<Instrument, string> = {
  "electric-guitar": "Electric guitar", "acoustic-guitar": "Acoustic guitar", bass: "Bass",
  "extended-range": "Extended range", keys: "Keys", drums: "Drums", vocals: "Vocals", production: "Production",
  percussion: "Percussion", strings: "Strings", woodwinds: "Woodwinds", brass: "Brass", dj: "DJ", other: "Other instruments",
};
