"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { Avatar, Chip, compact, IconButton, ManagedCreatorBadge, TimeAgo } from "@/components/app/ui";
import RichText from "@/components/app/RichText";
import MediaGallery from "@/components/media/MediaGallery";
import { SeekProvider } from "@/components/media/seek";
import ToneAttachment, { RigOverlay } from "@/components/social/ToneAttachment";
import ReleaseAttachment from "@/components/social/ReleaseAttachment";
import VoteControl from "@/components/social/VoteControl";
import { CATEGORY_META } from "@/components/social/categories";
import { api } from "@/lib/client-api";
import { useServerToggle } from "@/lib/queries/toggle";
import type { PostView } from "@/lib/posts";


// Loaded on first use: the dialog (and its animation runtime) isn't needed until someone reports.
const ReportDialog = dynamic(() => import("@/components/social/ReportDialog"), { ssr: false });
function Menu({ post, onReport, onDeleted }: { post: PostView; onReport: () => void; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  async function remove() {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    await api(`/api/posts/${post.id}`, { method: "DELETE" });
    onDeleted();
  }
  return (
    <div className="relative">
      <IconButton icon="more" label="Post options" size={36} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" />
      {open && (
        <div role="menu" className="panel absolute right-0 top-10 z-30 w-48 overflow-hidden p-1 shadow-panel" onMouseLeave={() => setOpen(false)}>
          <button role="menuitem" type="button" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body text-sm hover:bg-white/[0.05]" onClick={async () => { await navigator.clipboard.writeText(`${location.origin}/p/${post.id}`); setCopied(true); setTimeout(() => setOpen(false), 600); }}>
            <Icon name="link" size={16} /> {copied ? "Copied" : "Copy link"}
          </button>
          {post.viewer.isAuthor ? (
            <button role="menuitem" type="button" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body text-sm text-danger hover:bg-danger/10" onClick={remove}>
              <Icon name="trash" size={16} /> Delete post
            </button>
          ) : (
            <button role="menuitem" type="button" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-body text-sm hover:bg-white/[0.05]" onClick={() => { setOpen(false); onReport(); }}>
              <Icon name="flag" size={16} /> Report
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PostCard({ post, signedIn, detail = false, voteMode = "amp" }: { post: PostView; signedIn: boolean; detail?: boolean; voteMode?: "amp" | "updown" }) {
  const router = useRouter();
  const { on: bookmarked, toggle: flipBookmark } = useServerToggle({ scope: `bookmark:${post.id}`, initial: post.viewer.bookmarked, send: (next) => api(`/api/posts/${post.id}/bookmark`, { method: next ? "PUT" : "DELETE" }) });
  const [reporting, setReporting] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [gone, setGone] = useState(false);
  const [expanded, setExpanded] = useState(detail);
  const [linkCopied, setLinkCopied] = useState(false);
  const meta = CATEGORY_META[post.category];
  const long = post.body.length > 420;
  if (gone) return null;

  const toggleBookmark = () => (signedIn ? flipBookmark() : router.push(`/login?callbackUrl=/p/${post.id}`));

  async function share() {
    const url = `${location.origin}/p/${post.id}`;
    if (navigator.share) await navigator.share({ title: post.title ?? `@${post.author.handle} on Resoniq`, url }).catch(() => {});
    else {
      // Desktop browsers without a share sheet: copy, and say so.
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  return (
    <SeekProvider>
      <article className="panel relative overflow-hidden p-4 sm:p-5" aria-labelledby={`post-${post.id}-by`}>
        {post.status !== "PUBLISHED" && post.viewer.isAuthor && (
          <div className={`-mx-4 -mt-4 mb-4 flex items-center gap-2 px-4 py-2 font-body text-sm sm:-mx-5 sm:-mt-5 sm:px-5 ${post.status === "HELD" ? "bg-amber/10 text-amber" : "bg-signal/10 text-signal"}`}>
            <Icon name={post.status === "HELD" ? "shield" : "clock"} size={16} />
            {post.status === "HELD"
              ? `Held for review${post.heldReasons.length ? `: ${post.heldReasons.join(", ")}` : ""}. Only you can see it until a moderator approves it.`
              : "Your media is processing. The post goes live when it's ready."}
          </div>
        )}
        <header className="flex items-start gap-3">
          <Link href={`/u/${post.author.handle}`} className="focus-ring rounded-full" aria-hidden tabIndex={-1}>
            <Avatar user={post.author} size={42} />
          </Link>
          <div className="min-w-0 flex-1">
            <div id={`post-${post.id}-by`} className="flex flex-wrap items-baseline gap-x-2 font-body text-[15px]">
              <Link href={`/u/${post.author.handle}`} className="font-semibold hover:underline">{post.author.name ?? post.author.handle}</Link>
              <span className="font-mono text-xs text-muted">@{post.author.handle}</span>
              <span className="text-muted" aria-hidden>·</span>
              <TimeAgo iso={post.createdAt} className="font-mono text-xs text-muted" />
              {post.editedAt && <span className="font-mono text-[11px] text-muted">edited</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {post.author.managedCreator && <ManagedCreatorBadge />}
              {meta && post.category !== "DISCUSSION" && <Chip icon={meta.icon}>{meta.label}</Chip>}
              {post.community && (
                <Link href={`/c/${post.community.slug}`} className="focus-ring rounded-full">
                  <Chip icon="community" className="hover:border-copper/50">c/{post.community.slug}</Chip>
                </Link>
              )}
            </div>
          </div>
          <Menu post={post} onReport={() => { setReportLoaded(true); setReporting(true); }} onDeleted={() => (detail ? router.push("/feed") : setGone(true))} />
        </header>

        <div className="mt-3 space-y-3">
          {post.title &&
            (detail ? (
              <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{post.title}</h1>
            ) : (
              <h2 className="font-display text-xl font-semibold leading-snug">
                <Link href={`/p/${post.id}`} className="hover:text-copper-soft">{post.title}</Link>
              </h2>
            ))}
          {post.body && (
            <div className="font-body text-[15px] leading-relaxed text-ink-dim">
              <RichText timestamps text={expanded || !long ? post.body : `${post.body.slice(0, 420).trimEnd()}…`} />
              {long && !expanded && (
                <button type="button" onClick={() => setExpanded(true)} className="mt-1 font-body text-sm font-medium text-copper hover:underline">
                  Read more
                </button>
              )}
            </div>
          )}
          <MediaGallery media={post.media} title={post.title ?? undefined} videoOverlay={post.tone ? <RigOverlay tone={post.tone} /> : undefined} />
          {post.release && <ReleaseAttachment postId={post.id} release={post.release} detail={detail} isAuthor={post.viewer.isAuthor} />}
          {post.tone && <ToneAttachment tone={post.tone} />}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
              {post.tags.map((t) => (
                <Link key={t} href={`/tag/${t}`} className="text-signal hover:underline">#{t}</Link>
              ))}
            </div>
          )}
        </div>

        <footer className="mt-4 flex items-center gap-1 border-t hairline pt-3">
          <VoteControl url={`/api/posts/${post.id}/vote`} initialVote={post.viewer.vote} initialScore={post.score} initialUps={post.upCount} mode={voteMode} signedIn={signedIn} />
          <Link href={`/p/${post.id}#comments`} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 font-mono text-sm text-muted hover:bg-white/[0.05] hover:text-ink" aria-label={`${post.commentCount} comments`}>
            <Icon name="comment" size={19} /> {compact(post.commentCount)}
          </Link>
          <div className="ml-auto flex items-center">
            <IconButton icon={bookmarked ? "bookmark-filled" : "bookmark"} label={bookmarked ? "Remove bookmark" : "Bookmark"} active={bookmarked} onClick={toggleBookmark} size={36} />
            <IconButton icon={linkCopied ? "check" : "share"} label={linkCopied ? "Link copied" : "Share"} onClick={share} size={36} />
            <span role="status" className="sr-only">{linkCopied ? "Link copied" : ""}</span>
          </div>
        </footer>
        {reportLoaded && <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="POST" targetId={post.id} />}
      </article>
    </SeekProvider>
  );
}
