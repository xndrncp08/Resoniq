/** Portfolio choices and limits, shared by the profile editor, validation and discovery. */

export const OPEN_TO = [
  { id: "jam", label: "Jamming" },
  { id: "band", label: "Joining a band" },
  { id: "session", label: "Session work" },
  { id: "remote", label: "Remote collabs" },
  { id: "gigs", label: "Gigs" },
  { id: "teaching", label: "Teaching" },
  { id: "learning", label: "Finding a teacher" },
  { id: "feedback", label: "Feedback swaps" },
] as const;
export type OpenTo = (typeof OPEN_TO)[number]["id"];
export const OPEN_TO_LABEL = Object.fromEntries(OPEN_TO.map((o) => [o.id, o.label])) as Record<OpenTo, string>;
export const isOpenTo = (v: unknown): v is OpenTo => OPEN_TO.some((o) => o.id === v);

export const MAX_RIG = 24;
export const MAX_RIG_NOTE = 80;
export const MAX_INFLUENCES = 8;
export const MAX_LOCATION = 60;
