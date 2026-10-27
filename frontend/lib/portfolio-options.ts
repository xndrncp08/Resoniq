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
export const MAX_HIGHLIGHTS = 6;
export const MAX_HIGHLIGHT = 100;
export const MAX_AVAILABILITY_NOTE = 80;
export const DM_POLICIES = [
  { id: "EVERYONE", label: "Anyone on Resoniq" },
  { id: "FOLLOWING", label: "People you follow" },
  { id: "NOBODY", label: "No one" },
] as const;
export type DmPolicyId = (typeof DM_POLICIES)[number]["id"];

/** Whether someone's availability is current. */
export const isAvailable = (until: Date | string | null | undefined, now = new Date()) => !!until && new Date(until) >= now;
