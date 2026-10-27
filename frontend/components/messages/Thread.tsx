"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Icon from "@/components/icons/Icon";
import { Avatar, Button, IconButton, TimeAgo } from "@/components/app/ui";
import RichText from "@/components/app/RichText";
import MediaGallery from "@/components/media/MediaGallery";
import Uploader, { type UploadKinds } from "@/components/media/Uploader";
import { SeekProvider } from "@/components/media/seek";
import { useConfirmLeave, useUnsavedChanges } from "@/components/app/UnsavedChanges";
import { api, errorMessage } from "@/lib/client-api";
import { notificationKeys } from "@/lib/queries/notifications";
import { MESSAGE_REACTIONS, type ConversationSummary, type MessageView } from "@/lib/messaging-shared";

const ReportDialog = dynamic(() => import("@/components/social/ReportDialog"), { ssr: false });
const LIVE_MS = 4000;

function InviteCard({ m, onAnswered }: { m: MessageView; onAnswered: (status: "ACCEPTED" | "DECLINED", projectId: string | null) => void }) {
  const router = useRouter();
  const invite = m.invite!;
  const answer = useMutation({
    mutationFn: (accept: boolean) => api<{ projectId: string | null }>(`/api/messages/${m.id}/invite`, { body: { accept } }),
    onSuccess: ({ projectId }, accept) => {
      onAnswered(accept ? "ACCEPTED" : "DECLINED", projectId);
      if (projectId) router.push(`/messages/${projectId}`);
    },
  });
  return (
    <div className="panel-inset max-w-md rounded-2xl border-copper/30 p-4">
      <p className="label-engraved text-copper">Collaboration invite</p>
      <p className="mt-1 font-display text-lg font-semibold">{invite.title}</p>
      <dl className="mt-2 space-y-1 font-body text-sm">
        {invite.role && <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted">Looking for</dt><dd>{invite.role}</dd></div>}
        {invite.when && <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted">When</dt><dd>{invite.when}</dd></div>}
        {invite.where && <div className="flex gap-2"><dt className="w-24 shrink-0 text-muted">Where</dt><dd>{invite.where}</dd></div>}
      </dl>
      {invite.note && <RichText text={invite.note} className="mt-2 font-body text-sm text-ink-dim" />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {invite.status === "PENDING" && !m.mine ? (
          <>
            <Button size="sm" variant="primary" disabled={answer.isPending} onClick={() => answer.mutate(true)}>Accept and start the project</Button>
            <Button size="sm" variant="ghost" disabled={answer.isPending} onClick={() => answer.mutate(false)}>Decline</Button>
          </>
        ) : invite.status === "PENDING" ? (
          <span className="font-body text-sm text-muted">Waiting for an answer</span>
        ) : invite.status === "ACCEPTED" ? (
          <span className="font-body text-sm text-signal">Accepted{invite.projectId && <> · <Link href={`/messages/${invite.projectId}`} className="underline">Open the project</Link></>}</span>
        ) : (
          <span className="font-body text-sm text-muted">Declined</span>
        )}
      </div>
      {answer.error && <p role="alert" className="mt-2 font-body text-sm text-danger">{errorMessage(answer.error)}</p>}
    </div>
  );
}

function Bubble({ m, showAuthor, onReply, onChange, onReport }: { m: MessageView; showAuthor: boolean; onReply: () => void; onChange: (m: MessageView) => void; onReport: () => void }) {
  const [picking, setPicking] = useState(false);
  const react = useMutation({
    mutationFn: ({ emoji, on }: { emoji: string; on: boolean }) => api(`/api/messages/${m.id}/reactions`, { method: on ? "PUT" : "DELETE", body: { emoji } }),
    onMutate: ({ emoji, on }) => {
      const before = m;
      const has = m.reactions.find((r) => r.emoji === emoji);
      const reactions = on
        ? has ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)) : [...m.reactions, { emoji, count: 1, mine: true }]
        : m.reactions.flatMap((r) => (r.emoji !== emoji ? [r] : r.count > 1 ? [{ ...r, count: r.count - 1, mine: false }] : []));
      onChange({ ...m, reactions });
      return before;
    },
    onError: (_e, _v, before) => before && onChange(before),
  });
  const remove = useMutation({ mutationFn: () => api(`/api/messages/${m.id}`, { method: "DELETE" }), onSuccess: () => onChange({ ...m, deleted: true, body: "", media: [] }) });

  if (m.kind === "SYSTEM") {
    return <p className="py-1 text-center font-body text-xs text-muted"><span className="text-ink-dim">{m.author.name ?? m.author.handle}</span> {m.body}</p>;
  }
  return (
    <div id={`m-${m.id}`} className={`group flex gap-3 ${m.mine ? "flex-row-reverse" : ""}`}>
      <div className="w-8 shrink-0">{showAuthor && !m.mine && <Link href={`/u/${m.author.handle}`} tabIndex={-1} aria-hidden><Avatar user={m.author} size={32} /></Link>}</div>
      <div className={`flex min-w-0 max-w-[min(100%,560px)] flex-col ${m.mine ? "items-end" : "items-start"}`}>
        {showAuthor && <p className="mb-1 font-body text-xs text-muted">{m.mine ? "You" : m.author.name ?? m.author.handle} · <TimeAgo iso={m.createdAt} /></p>}
        {m.replyTo && (
          <a href={`#m-${m.replyTo.id}`} className="mb-1 max-w-full truncate rounded-lg border-l-2 border-copper/60 bg-white/[0.03] px-2.5 py-1 font-body text-xs text-muted hover:text-ink">
            {m.replyTo.author}: {m.replyTo.body || "a recording"}
          </a>
        )}
        {m.kind === "COLLAB_INVITE" && m.invite ? (
          <InviteCard m={m} onAnswered={(status, projectId) => onChange({ ...m, invite: { ...m.invite!, status, projectId } })} />
        ) : m.deleted ? (
          <p className="rounded-2xl border border-dashed border-line px-3.5 py-2 font-body text-sm italic text-muted">Message deleted</p>
        ) : (
          // Timestamps in a message play its own recording from that moment.
          <SeekProvider>
            <div className={`space-y-2 rounded-2xl px-3.5 py-2.5 ${m.mine ? "bg-copper/15" : "bg-white/[0.05]"}`}>
              {m.body && <RichText timestamps text={m.body} className="font-body text-[15px] leading-relaxed text-ink" />}
              {m.media.length > 0 && <div className="w-[min(480px,72vw)]"><MediaGallery media={m.media} /></div>}
            </div>
          </SeekProvider>
        )}
        <div className={`mt-1 flex flex-wrap items-center gap-1 ${m.mine ? "justify-end" : ""}`}>
          {m.reactions.map((r) => (
            <button key={r.emoji} type="button" aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}${r.mine ? ", yours" : ""}`} onClick={() => react.mutate({ emoji: r.emoji, on: !r.mine })} className={`focus-ring rounded-full border px-2 py-0.5 text-xs ${r.mine ? "border-copper/60 bg-copper/10" : "border-line"}`}>
              {r.emoji} <span className="font-mono text-[11px] text-muted">{r.count}</span>
            </button>
          ))}
          {!m.deleted && (
            <span className="flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <span className="relative">
                <IconButton icon="plus" label="Add a reaction" size={28} aria-expanded={picking} onClick={() => setPicking((p) => !p)} />
                {picking && (
                  <span role="menu" className={`panel absolute bottom-8 z-20 flex gap-0.5 p-1 shadow-panel ${m.mine ? "right-0" : "left-0"}`} onMouseLeave={() => setPicking(false)}>
                    {MESSAGE_REACTIONS.map((e) => (
                      <button key={e} role="menuitem" type="button" aria-label={`React ${e}`} className="focus-ring rounded-lg px-1.5 py-1 text-lg hover:bg-white/[0.08]" onClick={() => { setPicking(false); const r = m.reactions.find((x) => x.emoji === e); react.mutate({ emoji: e, on: !r?.mine }); }}>{e}</button>
                    ))}
                  </span>
                )}
              </span>
              <IconButton icon="comment" label="Reply" size={28} onClick={onReply} />
              {m.mine && m.kind === "TEXT" ? (
                <IconButton icon="trash" label="Delete message" size={28} disabled={remove.isPending} onClick={() => remove.mutate()} />
              ) : !m.mine ? (
                <IconButton icon="flag" label="Report message" size={28} onClick={onReport} />
              ) : null}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectBar({ c, userId }: { c: ConversationSummary; userId: string }) {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const [handle, setHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const add = useMutation({
    mutationFn: () => api(`/api/conversations/${c.id}/members`, { body: { handle } }),
    onSuccess: () => { setHandle(""); setAdding(false); router.refresh(); },
  });
  const leave = useMutation({ mutationFn: () => api(`/api/conversations/${c.id}/members`, { method: "DELETE" }), onSuccess: () => router.push("/messages?view=projects") });
  return (
    <div className="space-y-3 border-b border-line px-4 py-3 sm:px-5">
      {c.brief && <p className="font-body text-sm text-ink-dim">{c.brief}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <ul className="flex -space-x-2" aria-label="Members">
          {c.members.map((m) => <li key={m.id}><Link href={`/u/${m.handle}`} title={m.name ?? m.handle} className="focus-ring block rounded-full ring-2 ring-surface"><Avatar user={m} size={28} /></Link></li>)}
        </ul>
        <span className="font-body text-xs text-muted">{c.members.length} member{c.members.length > 1 ? "s" : ""}</span>
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setAdding((a) => !a)}>Add</Button>
          <Button size="sm" variant="ghost" disabled={leave.isPending} onClick={async () => { if (await confirmLeave()) leave.mutate(); }} aria-label={`Leave ${c.title}`}>Leave</Button>
        </span>
      </div>
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); if (handle.trim()) add.mutate(); }} className="flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Handle to add</span><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="panel-inset h-9 w-full rounded-lg px-3 font-mono text-sm outline-none" /></label>
          <Button size="sm" type="submit" disabled={add.isPending || !handle.trim()}>{add.isPending ? "Adding…" : "Add to project"}</Button>
          {add.error && <p role="alert" className="w-full font-body text-sm text-danger">{errorMessage(add.error)}</p>}
        </form>
      )}
      {c.members.every((m) => m.id === userId) && <p className="font-body text-xs text-muted">Everyone else has left this project.</p>}
    </div>
  );
}

/**
 * One conversation: newest at the bottom, new messages arriving every few
 * seconds while the page is visible, replies, reactions, recordings with
 * time-coded feedback, and collaboration invites you can answer in place.
 */
export default function Thread({ userId, conversation, initial, hasMore: initialHasMore, uploadKinds }: { userId: string; conversation: ConversationSummary; initial: MessageView[]; hasMore: boolean; uploadKinds: UploadKinds }) {
  const client = useQueryClient();
  const [messages, setMessages] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [reporting, setReporting] = useState<string | null>(null);
  const [recordingsOnly, setRecordingsOnly] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = messages.at(-1)?.createdAt ?? null;
  useUnsavedChanges({ dirty: !!body.trim() || mediaIds.length > 0 || uploading, label: "your message" });

  const upsert = (incoming: MessageView[]) => setMessages((cur) => {
    const byId = new Map(cur.map((m) => [m.id, m]));
    for (const m of incoming) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

  // Live, only while the tab is visible: new messages every tick, and every third tick the
  // latest page again so reactions, deletions and invite answers on recent messages catch up.
  useEffect(() => {
    let stop = false;
    let n = 0;
    const tick = async () => {
      if (document.hidden || stop) return;
      const refresh = ++n % 3 === 0;
      try {
        const r = await api<{ messages: MessageView[] }>(`/api/conversations/${conversation.id}${latest && !refresh ? `?after=${encodeURIComponent(latest)}` : ""}`);
        if (refresh && !stop) {
          upsert(r.messages);
          if (r.messages.at(-1)?.createdAt === latest) return;
        }
        if (r.messages.length && !stop) {
          upsert(r.messages);
          void api(`/api/conversations/${conversation.id}/read`, { method: "POST" }).then(() => client.invalidateQueries({ queryKey: notificationKeys.pulse(userId) }));
        }
      } catch { /* the next tick retries */ }
    };
    const id = window.setInterval(tick, LIVE_MS);
    const onShow = () => !document.hidden && void tick();
    document.addEventListener("visibilitychange", onShow);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, [conversation.id, latest, client, userId]);

  useEffect(() => {
    void api(`/api/conversations/${conversation.id}/read`, { method: "POST" }).then(() => client.invalidateQueries({ queryKey: notificationKeys.pulse(userId) })).catch(() => {});
  }, [conversation.id, client, userId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const older = useMutation({
    mutationFn: () => api<{ messages: MessageView[]; hasMore: boolean }>(`/api/conversations/${conversation.id}?before=${encodeURIComponent(messages[0].createdAt)}`),
    onSuccess: (r) => { upsert(r.messages); setHasMore(r.hasMore); },
  });
  const send = useMutation({
    mutationFn: () => api<{ message: MessageView }>(`/api/conversations/${conversation.id}/messages`, { body: { body, replyToId: replyTo?.id ?? null, mediaIds } }),
    onSuccess: ({ message }) => {
      upsert([message]);
      setBody("");
      setReplyTo(null);
      setMediaIds([]);
      setUploaderKey((k) => k + 1);
    },
  });
  const canSend = !send.isPending && !uploading && (!!body.trim() || mediaIds.length > 0);
  const shown = recordingsOnly ? messages.filter((m) => m.media.length > 0) : messages;
  const other = conversation.members.find((m) => m.id !== userId);

  return (
    <div className="panel flex min-h-[70dvh] flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <Link href="/messages" className="focus-ring rounded-full p-1 text-muted hover:text-ink md:hidden" aria-label="All messages"><Icon name="chevron-left" size={20} /></Link>
        {conversation.kind === "PROJECT" ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper/12 text-copper"><Icon name="users" size={18} /></span>
        ) : other ? <Avatar user={other} size={36} /> : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold">{conversation.title}</h1>
          {conversation.kind === "DIRECT" && other && <Link href={`/u/${other.handle}`} className="font-mono text-xs text-muted hover:text-ink">@{other.handle}</Link>}
          {conversation.kind === "PROJECT" && <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-copper">Shared project</p>}
        </div>
        <Button size="sm" variant="ghost" icon="audio" aria-pressed={recordingsOnly} aria-label={recordingsOnly ? "Show all messages" : "Show recordings only"} onClick={() => setRecordingsOnly((r) => !r)}><span className="hidden sm:inline">{recordingsOnly ? "All messages" : "Recordings"}</span></Button>
      </header>
      {conversation.kind === "PROJECT" && <ProjectBar c={conversation} userId={userId} />}

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-label="Messages">
        {hasMore && !recordingsOnly && <div className="text-center"><Button size="sm" variant="ghost" disabled={older.isPending} onClick={() => older.mutate()}>{older.isPending ? "Loading…" : "Earlier messages"}</Button></div>}
        {shown.length === 0 && <p className="py-10 text-center font-body text-sm text-muted">{recordingsOnly ? "No recordings shared yet. Attach one below." : "Say hello. A take, a question or an idea is a good start."}</p>}
        {shown.map((m, i) => (
          <Bubble
            key={m.id}
            m={m}
            showAuthor={i === 0 || shown[i - 1].author.id !== m.author.id || shown[i - 1].kind === "SYSTEM" || Date.parse(m.createdAt) - Date.parse(shown[i - 1].createdAt) > 10 * 60_000}
            onReply={() => setReplyTo(m)}
            onChange={(next) => upsert([next])}
            onReport={() => setReporting(m.id)}
          />
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (canSend) send.mutate(); }} className="space-y-2 border-t border-line p-3 sm:p-4">
        {replyTo && (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 font-body text-xs text-muted">
            <span className="min-w-0 flex-1 truncate">Replying to {replyTo.mine ? "yourself" : replyTo.author.name ?? replyTo.author.handle}: {replyTo.body || "a recording"}</span>
            <IconButton icon="close" label="Cancel reply" size={24} onClick={() => setReplyTo(null)} />
          </div>
        )}
        <label className="block">
          <span className="sr-only">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) send.mutate(); } }}
            rows={2}
            maxLength={4000}
            placeholder="Message · point to moments like 1:24 · Shift+Enter for a new line"
            className="panel-inset w-full resize-none rounded-xl px-3.5 py-2.5 font-body text-[15px] outline-none focus:border-copper/60"
          />
        </label>
        {send.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(send.error)} Your message is still here.</p>}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {(uploadKinds.images || uploadKinds.audio || uploadKinds.video) && <Uploader key={uploaderKey} compact purpose="MESSAGE" max={4} kinds={uploadKinds} onChange={(ids, busy) => { setMediaIds(ids); setUploading(busy); }} />}
          </div>
          <Button type="submit" variant="primary" icon="arrow-up" disabled={!canSend}>{send.isPending ? "Sending…" : uploading ? "Uploading…" : "Send"}</Button>
        </div>
      </form>
      {reporting && <ReportDialog open onClose={() => setReporting(null)} targetType="MESSAGE" targetId={reporting} />}
    </div>
  );
}
