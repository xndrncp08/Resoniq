import type { ModerationRuleKind } from "@prisma/client";
import { fail } from "@/lib/validation";

export const RULE_KINDS: ModerationRuleKind[] = ["BLOCKED_TERM", "LINK_HOLD_NEW_ACCOUNTS", "MAX_MENTIONS", "REPORT_HOLD"];

/** Validates a rule's config for its kind (shapes documented in lib/automod.ts). */
export function parseRuleConfig(kind: ModerationRuleKind, v: unknown): Record<string, unknown> {
  const o = (v ?? {}) as Record<string, unknown>;
  const int = (x: unknown, min: number, max: number, name: string) => {
    const n = Number(x);
    if (!Number.isInteger(n) || n < min || n > max) fail(`${name} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  switch (kind) {
    case "BLOCKED_TERM": {
      const terms = (Array.isArray(o.terms) ? o.terms : typeof o.terms === "string" ? o.terms.split(/\n|,/) : [])
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean);
      if (terms.length > 500 || terms.some((t) => t.length > 60)) fail("Up to 500 terms of 60 characters each.");
      return { terms: [...new Set(terms)] };
    }
    case "LINK_HOLD_NEW_ACCOUNTS":
      return { hours: int(o.hours, 1, 24 * 30, "Hours") };
    case "MAX_MENTIONS":
      return { max: int(o.max, 1, 50, "Max mentions") };
    case "REPORT_HOLD":
      return { reports: int(o.reports, 1, 50, "Reports") };
  }
}
