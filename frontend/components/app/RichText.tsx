import Link from "next/link";
import { tokenize } from "@/lib/rich-text";

/** Renders plain user text with links for mentions, hashtags and URLs. Never injects HTML. */
export default function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {tokenize(text).map((t, i) => {
        if (t.type === "mention") return <Link key={i} href={`/u/${t.handle}`} className="font-medium text-copper hover:underline">{t.value}</Link>;
        if (t.type === "hashtag") return <Link key={i} href={`/tag/${t.tag}`} className="text-signal hover:underline">{t.value}</Link>;
        if (t.type === "url") return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-copper">{t.value.replace(/^https?:\/\//, "")}</a>;
        return <span key={i}>{t.value}</span>;
      })}
    </div>
  );
}
