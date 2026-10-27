/**
 * Privacy choices. Essential cookies (sign-in and its security tokens) are
 * always on. Everything optional is off until the visitor chooses:
 *   - preferences: remembering settings and unsent work in this browser's
 *     localStorage (display and 3D choices, metronome, gear profile, composer
 *     drafts, practice notes, TANK-G bank plans);
 *   - analytics: Resoniq runs no analytics today. The choice exists so that
 *     any measurement added later stays off for everyone who hasn't allowed it.
 * The choice itself is kept in a first-party cookie (essential: it's how the
 * choice is remembered) so the server can render without a banner flash.
 */

export const CONSENT_COOKIE = "resoniq_consent";
/** Ask again after six months, a common guideline for remembering a refusal or consent. */
export const CONSENT_MAX_AGE_S = 60 * 60 * 24 * 182;
export const CONSENT_VERSION = 1;

export type Consent = { preferences: boolean; analytics: boolean; at: number };
export type ConsentCategory = "preferences" | "analytics";

/** Cookie value: "1.p1.a0.<unix seconds>". Anything else (or an older version) means no choice yet. */
export function serializeConsent(c: Consent): string {
  return `${CONSENT_VERSION}.p${c.preferences ? 1 : 0}.a${c.analytics ? 1 : 0}.${Math.floor(c.at / 1000)}`;
}

export function parseConsent(raw: string | undefined | null): Consent | null {
  const m = /^(\d+)\.p([01])\.a([01])\.(\d{1,12})$/.exec(raw ?? "");
  if (!m || Number(m[1]) !== CONSENT_VERSION) return null;
  return { preferences: m[2] === "1", analytics: m[3] === "1", at: Number(m[4]) * 1000 };
}

export function readConsentCookie(cookie: string): Consent | null {
  const part = cookie.split(/;\s*/).find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(part ? decodeURIComponent(part.slice(CONSENT_COOKIE.length + 1)) : null);
}

export function writeConsentCookie(c: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(c)}; Path=/; Max-Age=${CONSENT_MAX_AGE_S}; SameSite=Lax${secure}`;
}

export function hasConsent(category: ConsentCategory): boolean {
  if (typeof document === "undefined") return false;
  return readConsentCookie(document.cookie)?.[category] === true;
}

// ── On-device storage, gated by the preferences choice ─────────────────

/** Keys Resoniq writes to localStorage; withdrawing consent removes them. */
export const isResoniqKey = (k: string) => k.startsWith("resoniq:") || k.startsWith("resoniq.");

const memory = new Map<string, string>();

/**
 * localStorage when the visitor allowed on-device preferences, otherwise an
 * in-memory stand-in that lasts for this visit only. Never throws (private
 * modes and full storage just fall back to memory).
 */
export const deviceStorage = {
  getItem(key: string): string | null {
    if (hasConsent("preferences")) {
      try {
        return localStorage.getItem(key);
      } catch { /* fall through */ }
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
    if (!hasConsent("preferences")) return;
    try {
      localStorage.setItem(key, value);
    } catch { /* kept in memory */ }
  },
  removeItem(key: string) {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch { /* nothing stored */ }
  },
};

/** After preferences are withdrawn: forget everything Resoniq stored in this browser. */
export function clearDeviceStorage() {
  try {
    for (const k of Object.keys(localStorage)) if (isResoniqKey(k)) localStorage.removeItem(k);
  } catch { /* storage unavailable: nothing to clear */ }
}

/** When preferences are allowed mid-visit, keep what was set in memory. */
export function persistMemory() {
  try {
    for (const [k, v] of memory) localStorage.setItem(k, v);
  } catch { /* storage unavailable */ }
}
