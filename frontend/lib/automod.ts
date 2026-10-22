import type { ModerationRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractMentions } from "@/lib/rich-text";

/**
 * Rule-based automated moderation. Nothing is removed automatically: matching
 * content is HELD for a human, visible only to its author and staff.
 * Rules are rows (ModerationRule) admins edit; configs by kind:
 *   BLOCKED_TERM            { terms: string[] }   case-insensitive whole words
 *   LINK_HOLD_NEW_ACCOUNTS  { hours: number }     links from accounts younger than this
 *   MAX_MENTIONS            { max: number }
 *   REPORT_HOLD             { reports: number }   distinct open reports before a hold
 */

export type Screen = { hold: boolean; reasons: string[] };

const TTL_MS = 30_000;
let cache: { at: number; rules: ModerationRule[] } | null = null;

export async function activeRules(): Promise<ModerationRule[]> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    cache = { at: Date.now(), rules: await prisma.moderationRule.findMany({ where: { enabled: true } }) };
  }
  return cache.rules;
}

export function clearRuleCache() {
  cache = null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pure rule evaluation, separate from loading so it can be tested directly. */
export function evaluate(rules: Pick<ModerationRule, "kind" | "config" | "label">[], text: string, author: { createdAt: Date }, now = new Date()): Screen {
  const reasons: string[] = [];
  for (const rule of rules) {
    const config = (rule.config ?? {}) as Record<string, unknown>;
    if (rule.kind === "BLOCKED_TERM") {
      const terms = (Array.isArray(config.terms) ? config.terms : []).filter((t): t is string => typeof t === "string" && !!t.trim());
      if (terms.some((t) => new RegExp(`(^|\\W)${escape(t.trim())}(\\W|$)`, "i").test(text))) reasons.push(rule.label);
    } else if (rule.kind === "LINK_HOLD_NEW_ACCOUNTS") {
      const hours = Number(config.hours) || 0;
      const young = now.getTime() - author.createdAt.getTime() < hours * 3_600_000;
      if (young && /https?:\/\//i.test(text)) reasons.push(rule.label);
    } else if (rule.kind === "MAX_MENTIONS") {
      const max = Number(config.max) || Infinity;
      if (extractMentions(text, 1000).length > max) reasons.push(rule.label);
    }
  }
  return { hold: reasons.length > 0, reasons };
}

export async function screenText(text: string, author: { createdAt: Date }): Promise<Screen> {
  return evaluate(await activeRules(), text, author);
}

export async function reportHoldThreshold(): Promise<number> {
  const rule = (await activeRules()).find((r) => r.kind === "REPORT_HOLD");
  return Number((rule?.config as { reports?: unknown } | undefined)?.reports) || Infinity;
}

/** True when the text contains a blocked term (used to refuse community names outright). */
export async function hasBlockedTerm(text: string): Promise<boolean> {
  const rules = (await activeRules()).filter((r) => r.kind === "BLOCKED_TERM");
  return evaluate(rules, text, { createdAt: new Date(0) }).hold;
}
