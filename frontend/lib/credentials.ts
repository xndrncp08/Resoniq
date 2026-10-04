import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only reads the first 72 bytes; longer passwords would be silently truncated.
export const MAX_PASSWORD_BYTES = 72;
export const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

// Deliberately loose: one @, something on each side, a dot in the domain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : null;
}

/** Returns an error message, or null if the password is acceptable. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`;
  }
  return null;
}

// A real bcrypt hash of a random string, compared against when there is no
// user, so a failed sign-in takes as long whether or not the email exists.
let dummyHash: Promise<string> | null = null;
export function compareAgainstDummy(password: string): Promise<boolean> {
  dummyHash ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);
  return dummyHash.then((hash) => bcrypt.compare(password, hash));
}
