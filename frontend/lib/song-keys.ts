/** Keys a song, riff or setlist entry can be in: every major and minor, sharps and flats as written. */
export const SONG_KEYS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"].flatMap((k) => [k, `${k}m`]);
