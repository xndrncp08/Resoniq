/**
 * User text is plain text. This finds the parts that render as links —
 * mentions, hashtags and URLs — so components can build React nodes from
 * tokens instead of ever injecting HTML.
 */
export type Token =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; handle: string }
  | { type: "hashtag"; value: string; tag: string }
  | { type: "url"; value: string; href: string };

const PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|(^|[^\w@])@([a-z0-9_]{3,30})\b|(^|[^\w&#])#([a-z0-9_]{2,40})\b/gi;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  const push = (value: string) => {
    if (!value) return;
    const prev = out[out.length - 1];
    if (prev?.type === "text") prev.value += value;
    else out.push({ type: "text", value });
  };
  for (const m of text.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    push(text.slice(last, start));
    if (m[1]) {
      out.push({ type: "url", value: m[1], href: m[1] });
    } else if (m[3]) {
      push(m[2]);
      out.push({ type: "mention", value: `@${m[3]}`, handle: m[3].toLowerCase() });
    } else if (m[5]) {
      push(m[4]);
      out.push({ type: "hashtag", value: `#${m[5]}`, tag: m[5].toLowerCase() });
    }
    last = start + m[0].length;
  }
  push(text.slice(last));
  return out;
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function extractTags(text: string, max = 10): string[] {
  return uniq(tokenize(text).flatMap((t) => (t.type === "hashtag" ? [t.tag] : []))).slice(0, max);
}

export function extractMentions(text: string, max = 10): string[] {
  return uniq(tokenize(text).flatMap((t) => (t.type === "mention" ? [t.handle] : []))).slice(0, max);
}

export const normalizeTag = (tag: string) => tag.trim().replace(/^#/, "").toLowerCase();
export const TAG_PATTERN = /^[a-z0-9_]{2,40}$/;
