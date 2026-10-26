import Link from "next/link";
import { tokenize, withTimestamps } from "@/lib/rich-text";
import { TimeLink } from "@/components/media/seek";

/**
 * Renders plain user text with links for mentions, hashtags and URLs. Never injects HTML.
 * `timestamps`: m:ss times seek the recording in the surrounding SeekProvider.
 */
export default function RichText({ text, className = "", timestamps = false }: { text: string; className?: string; timestamps?: boolean }) {
  const tokens = tokenize(text);
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {(timestamps ? withTimestamps(tokens) : tokens).map((t, i) => {
        if (t.type === "mention") return <Link key={i} href={`/u/${t.handle}`} className="font-medium text-copper hover:underline">{t.value}</Link>;
        if (t.type === "hashtag") return <Link key={i} href={`/tag/${t.tag}`} className="text-signal hover:underline">{t.value}</Link>;
        if (t.type === "url") return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-copper">{t.value.replace(/^https?:\/\//, "")}</a>;
        if (t.type === "time") return <TimeLink key={i} seconds={t.seconds} label={t.value} />;
        return <span key={i}>{t.value}</span>;
      })}
    </div>
  );
}
