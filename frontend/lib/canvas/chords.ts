/**
 * Lyrics with inline chords in ChordPro style: "[Am]Hold the [F]line".
 * Parsed into chord/lyric pairs for display above the words, and transposed
 * by semitones keeping the writer's sharps or flats.
 */

export type ChordSegment = { chord: string | null; text: string };

export function parseChordLine(line: string): ChordSegment[] {
  const out: ChordSegment[] = [];
  const re = /\[([^\]\n]{1,16})\]/g;
  let last = 0;
  let chord: string | null = null;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last || chord !== null) out.push({ chord, text: line.slice(last, m.index) });
    chord = m[1].trim();
    last = m.index + m[0].length;
  }
  if (last < line.length || chord !== null) out.push({ chord, text: line.slice(last) });
  return out.filter((s, i) => i > 0 || s.chord !== null || s.text !== "");
}

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE = /^([A-G])([#b]?)/;

function shiftNote(note: string, semitones: number, preferFlat: boolean): string {
  const m = NOTE.exec(note);
  if (!m) return note;
  const base = SHARP.indexOf(m[1]);
  const idx = (base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + semitones + 120) % 12;
  return (preferFlat ? FLAT : SHARP)[idx] + note.slice(m[0].length);
}

/** "F#m7/C#" up 2 → "G#m7/D#". Anything that isn't a chord (e.g. "N.C.") is left alone. */
export function transposeChord(chord: string, semitones: number): string {
  if (!semitones || !NOTE.test(chord)) return chord;
  const preferFlat = /^[A-G]b/.test(chord) || /\/[A-G]b/.test(chord);
  const [main, bass] = chord.split("/");
  return bass !== undefined ? `${shiftNote(main, semitones, preferFlat)}/${shiftNote(bass, semitones, preferFlat)}` : shiftNote(main, semitones, preferFlat);
}

export function transposeText(text: string, semitones: number): string {
  return semitones ? text.replace(/\[([^\]\n]{1,16})\]/g, (_, c: string) => `[${transposeChord(c.trim(), semitones)}]`) : text;
}

/** Key names transpose too ("Am" up 3 → "Cm"). */
export const transposeKey = (key: string | null, semitones: number) => (key ? transposeChord(key, semitones) : key);
