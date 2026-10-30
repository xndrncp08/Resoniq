/** Public, viewer-independent tone data (Tone DNA neighbours); keyed by tone, not user. */
export const toneKeys = { similar: (toneId: string) => ["tones", toneId, "similar"] as const };

/** The owner's version history of a tone (Tone Time Machine). */
export const versionKeys = { tone: (userId: string, toneId: string) => ["user", userId, "tones", toneId, "versions"] as const };
