"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Avatar, Button, TimeAgo } from "@/components/app/ui";
import RichText from "@/components/app/RichText";
import MentionTextarea from "@/components/social/MentionTextarea";
import { useUnsavedChanges } from "@/components/app/UnsavedChanges";
import VoteControl from "@/components/social/VoteControl";
import { buildTree, type TreeNode } from "@/lib/comment-tree";
import { api, errorMessage } from "@/lib/client-api";
import type { CommentView } from "@/lib/comments";

// Loaded on first use: the dialog (and its animation runtime) isn't needed until someone reports.
const ReportDialog = dynamic(() => import("@/components/social/ReportDialog"), { ssr: false });

type Ctx = { postId: string; signedIn: boolean; onAdd: (c: CommentView) => void; onChange: (c: CommentView) => void; open: boolean };

function Composer({ postId, parentId, onDone, autoFocus = false, placeholder = "Add to the discussion" }: { postId: string; parentId: string | null; onDone: (c: CommentView) => void; autoFocus?: boolean; placeholder?: string }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A half-written comment is worth a question before leaving the page.
  useUnsavedChanges({ dirty: !!body.trim(), label: parentId ? "your reply" : "your comment" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api<{ comment: CommentView }>(`/api/posts/${postId}/comments`, { body: { body, parentId } });
      setBody("");
      onDone(comment);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="sr-only" htmlFor={`c-${parentId ?? "root"}`}>{placeholder}</label>
      <MentionTextarea id={`c-${parentId ?? "root"}`} value={body} onValueChange={setBody} autoFocus={autoFocus} rows={parentId ? 2 : 3} maxLength={5000} placeholder={placeholder} className="panel-inset w-full resize-y rounded-2xl px-4 py-3 font-body text-[15px] text-ink outline-none placeholder:text-muted focus:border-copper/60" />
      {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={busy || !body.trim()}>{busy ? "Posting…" : parentId ? "Reply" : "Comment"}</Button>
      </div>
    </form>
  );
}

function Node({ node, ctx, depth }: { node: TreeNode<CommentView>; ctx: Ctx; depth: number }) {
  const [replying, setReplying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const gone = !node.author;
  async function remove() {
    if (!window.confirm("Delete this comment?")) return;
    await api(`/api/comments/${node.id}`, { method: "DELETE" });
    ctx.onChange({ ...node, body: "", author: null, status: "DELETED" });
  }
  return (
    <li className="relative">
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          {node.author ? <Avatar user={node.author} size={30} /> : <span className="h-[30px] w-[30px] rounded-full border border-dashed border-line-strong" />}
          {node.children.length > 0 && !collapsed && (
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse thread" className="group mt-1 flex w-4 flex-1 justify-center">
              <span className="w-px bg-line group-hover:bg-copper/60" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-3">
          <div className="flex flex-wrap items-baseline gap-x-2 font-body text-sm">
            {node.author ? (
              <Link href={`/u/${node.author.handle}`} className="font-semibold hover:underline">{node.author.name ?? node.author.handle}</Link>
            ) : (
              <span className="text-muted">{node.status === "REMOVED" ? "[removed]" : "[deleted]"}</span>
            )}
            <TimeAgo iso={node.createdAt} className="font-mono text-xs text-muted" />
            {node.editedAt && <span className="font-mono text-[11px] text-muted">edited</span>}
            {node.status === "HELD" && <span className="font-mono text-[11px] text-amber">held for review</span>}
          </div>
          {!gone && <RichText timestamps text={node.body} className="mt-1 font-body text-[15px] leading-relaxed text-ink-dim" />}
          {!gone && (
            <div className="mt-1.5 flex items-center gap-1 font-body text-xs">
              <VoteControl url={`/api/comments/${node.id}/vote`} initialVote={node.viewer.vote} initialScore={node.score} initialUps={0} mode="updown" signedIn={ctx.signedIn} />
              {ctx.open && depth < 6 && (
                <button type="button" onClick={() => setReplying((r) => !r)} className="focus-ring rounded-full px-2.5 py-1.5 text-muted hover:bg-white/[0.05] hover:text-ink">Reply</button>
              )}
              {node.viewer.isAuthor ? (
                <button type="button" onClick={remove} className="focus-ring rounded-full px-2.5 py-1.5 text-muted hover:text-danger">Delete</button>
              ) : (
                ctx.signedIn && <button type="button" onClick={() => { setReportLoaded(true); setReporting(true); }} className="focus-ring rounded-full px-2.5 py-1.5 text-muted hover:text-ink">Report</button>
              )}
            </div>
          )}
          {replying && (
            <div className="mt-2">
              <Composer postId={ctx.postId} parentId={node.id} autoFocus placeholder={`Reply to ${node.author?.name ?? "comment"}`} onDone={(c) => { setReplying(false); ctx.onAdd(c); }} />
            </div>
          )}
          {collapsed ? (
            <button type="button" onClick={() => setCollapsed(false)} className="mt-1 font-mono text-xs text-copper hover:underline">
              + {node.children.length} {node.children.length === 1 ? "reply" : "replies"}
            </button>
          ) : (
            node.children.length > 0 && (
              <ul className="mt-3">
                {node.children.map((c) => <Node key={c.id} node={c} ctx={ctx} depth={depth + 1} />)}
              </ul>
            )
          )}
        </div>
      </div>
      {reportLoaded && <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="COMMENT" targetId={node.id} />}
    </li>
  );
}

export default function CommentThread({ postId, initial, signedIn, open }: { postId: string; initial: CommentView[]; signedIn: boolean; open: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [sort, setSort] = useState<"top" | "new">("top");
  const tree = useMemo(() => buildTree(items, sort), [items, sort]);
  const ctx: Ctx = {
    postId,
    signedIn,
    open,
    onAdd: (c) => setItems((prev) => [...prev, c]),
    onChange: (c) => setItems((prev) => prev.map((p) => (p.id === c.id ? c : p))),
  };
  return (
    <section id="comments" aria-label="Comments" className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Discussion <span className="font-mono text-sm text-muted">{items.filter((i) => i.author).length}</span></h2>
        <div className="flex gap-1" role="group" aria-label="Sort comments">
          {(["top", "new"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={`focus-ring rounded-full px-3 py-1.5 font-body text-sm ${sort === s ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{s === "top" ? "Top" : "Newest"}</button>
          ))}
        </div>
      </div>
      {open && (signedIn ? (
        <Composer postId={postId} parentId={null} onDone={ctx.onAdd} />
      ) : (
        <button type="button" onClick={() => router.push(`/login?callbackUrl=/p/${postId}`)} className="panel-inset w-full rounded-2xl px-4 py-3 text-left font-body text-muted hover:border-copper/40">Sign in to join the discussion</button>
      ))}
      {tree.length ? <ul>{tree.map((n) => <Node key={n.id} node={n} ctx={ctx} depth={0} />)}</ul> : <p className="font-body text-sm text-muted">No comments yet.</p>}
    </section>
  );
}
