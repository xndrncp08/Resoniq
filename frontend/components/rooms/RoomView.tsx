"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/app/ui";
import { Waveform } from "@/components/riffs/TakePlayer";
import { api, ClientApiError, errorMessage } from "@/lib/client-api";
import { bestOffset, clockOffset, correction, expectedPosition, type RoomClock } from "@/lib/rooms/sync";
import { ROOM_REACTIONS, type RoomComment, type RoomState } from "@/lib/rooms/service";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * A shared listening session. The server's clock is the truth: this page
 * polls it, estimates the offset from its own clock, and keeps the local
 * player on it (gentle speed changes for small drift, a seek for big jumps).
 */
export default function RoomView({ id }: { id: string }) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(0);
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const clock = useRef<RoomClock>({ playing: false, positionSec: 0, stateAt: 0 });
  const samples = useRef<{ rtt: number; offset: number }[]>([]);
  const lastComment = useRef<string | null>(null);
  const kick = useRef<() => void>(() => {});
  const offset = () => bestOffset(samples.current);
  const duration = room?.take?.durationSec ?? mediaDuration ?? Infinity;

  // Poll the room: every 2 s while playing, 4 s otherwise; back off while the connection is down.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      const sentAt = Date.now();
      try {
        const { room: r } = await api<{ room: RoomState }>(`/api/rooms/${id}/sync`, { body: { since: lastComment.current } });
        const receivedAt = Date.now();
        samples.current = [...samples.current.slice(-9), { rtt: receivedAt - sentAt, offset: clockOffset(sentAt, receivedAt, r.serverNow) }];
        clock.current = { playing: r.playing, positionSec: r.positionSec, stateAt: r.stateAt };
        if (r.comments.length) {
          lastComment.current = r.comments.at(-1)!.createdAt;
          setComments((c) => [...c, ...r.comments.filter((x) => !c.some((y) => y.id === x.id))]);
        }
        if (alive) { setRoom(r); setPlaying(r.playing); setConn("live"); setError(null); }
        failures = 0;
      } catch (err) {
        if (err instanceof ClientApiError && err.status === 404) { if (alive) setError("This room isn't available to you."); return; }
        failures++;
        if (alive) setConn("reconnecting");
      }
      if (alive) timer = setTimeout(poll, Math.min(30_000, (clock.current.playing ? 2000 : 4000) * 2 ** Math.min(failures, 3)));
    };
    kick.current = () => { clearTimeout(timer); void poll(); };
    const onVisible = () => document.visibilityState === "visible" && kick.current();
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [id]);

  // Follow the clock four times a second.
  useEffect(() => {
    const t = setInterval(() => {
      const a = audio.current;
      const expected = expectedPosition(clock.current, Date.now(), offset(), duration);
      setNow(expected);
      if (!a || !joined || !room?.take || room.ended) return;
      if (clock.current.playing && expected < duration) {
        if (a.paused) { a.currentTime = expected; void a.play().catch(() => setJoined(false)); return; }
        const fix = correction(a.currentTime, expected);
        if (fix.seekTo !== null) a.currentTime = fix.seekTo;
        a.playbackRate = fix.rate;
      } else {
        if (!a.paused) a.pause();
        a.playbackRate = 1;
        if (Math.abs(a.currentTime - expected) > 0.1) a.currentTime = expected;
      }
    }, 250);
    return () => clearInterval(t);
  }, [joined, room?.take, room?.ended, duration]);

  async function control(action: "play" | "pause" | "seek" | "load", extra: { positionSec?: number; takeId?: string } = {}) {
    // Apply locally at once (the next poll confirms), so the controller hears no lag.
    const at = Date.now() + offset();
    const pos = extra.positionSec ?? expectedPosition(clock.current, Date.now(), offset(), duration);
    if (action === "play") { clock.current = { playing: true, positionSec: pos, stateAt: at }; setPlaying(true); }
    if (action === "pause") { clock.current = { playing: false, positionSec: pos, stateAt: at }; setPlaying(false); }
    if (action === "seek") clock.current = { ...clock.current, positionSec: pos, stateAt: at };
    try {
      await api(`/api/rooms/${id}/control`, { body: { action, ...(action !== "load" && { positionSec: pos }), ...extra } });
    } catch (err) {
      setError(errorMessage(err));
    }
    kick.current();
  }
  async function send(body: { body?: string; emoji?: string }) {
    try {
      await api(`/api/rooms/${id}/comments`, { body: { atSec: Math.round(now * 10) / 10, ...body } });
      setText("");
      kick.current();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (error && !room) return <p role="alert" className="font-body text-danger">{error}</p>;
  if (!room) return <p className="font-body text-muted">Joining the room…</p>;
  const take = room.take;
  const current = comments.filter((c) => c.takeId === take?.id).sort((a, b) => a.atSec - b.atSec);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="label-engraved text-copper">Listening room · <Link href={`/messages/${room.project.id}`} className="hover:underline">{room.project.title ?? "Project"}</Link></p>
          <h1 className="font-display text-display-sm font-semibold">{room.title}</h1>
        </div>
        <span role="status" aria-live="polite" className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${room.ended ? "bg-surface-3 text-muted" : conn === "live" ? "bg-signal/15 text-signal" : "bg-amber/15 text-amber"}`}>
          {room.ended ? "Ended" : conn === "live" ? "Live" : conn === "connecting" ? "Connecting…" : "Reconnecting…"}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-muted" aria-label="Who's here">
        Here now: {room.present.map((p) => <span key={p.id} className="rounded-full border border-line px-2 py-0.5 text-ink-dim">@{p.handle}{p.id === room.host.id ? " (host)" : ""}</span>)}
      </div>

      {room.ended ? (
        <p className="rounded-xl border border-line p-4 font-body text-sm text-muted">This session has ended. Its comments are below; start a new room from the project to listen again.</p>
      ) : !take ? (
        <p className="rounded-xl border border-line p-4 font-body text-sm text-muted">Nothing to play yet. Record a take on one of the project&apos;s riffs in the Riff Vault, then load it here.</p>
      ) : (
        <section aria-label="Player" className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4">
          <audio ref={audio} src={take.src} preload="auto" onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setMediaDuration(e.currentTarget.duration)} />
          <p className="font-body text-sm"><span className="font-medium text-ink">{take.riffTitle}</span>{take.label ? <span className="text-muted"> · {take.label}</span> : null}</p>
          <div className="relative flex items-center gap-3">
            {room.canControl ? (
              <IconButton icon={playing ? "pause" : "play"} label={playing ? "Pause for everyone" : "Play for everyone"} onClick={() => control(playing ? "pause" : "play")} size={44} />
            ) : <span className="w-11" />}
            <div className="relative flex min-w-0 flex-1">
              <Waveform peaks={take.peaks} progress={Number.isFinite(duration) && duration ? now / duration : 0} onSeek={room.canControl && Number.isFinite(duration) ? (f) => control("seek", { positionSec: f * duration }) : undefined} label="Position for everyone" />
              {Number.isFinite(duration) && current.map((c) => <span key={c.id} aria-hidden title={`${fmt(c.atSec)} ${c.emoji ?? c.body}`} className="pointer-events-none absolute -top-3 -translate-x-1/2 text-xs" style={{ left: `${(c.atSec / duration) * 100}%` }}>{c.emoji ?? "•"}</span>)}
            </div>
            <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">{fmt(now)}</span>
          </div>
          {!joined && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-copper/10 p-3">
              <Button variant="primary" icon="headphones" onClick={() => { const a = audio.current; if (a) { a.muted = false; void a.play().then(() => { if (!clock.current.playing) a.pause(); }).catch(() => {}); } setJoined(true); }}>Join audio</Button>
              <p className="font-body text-xs text-muted">Browsers need a tap before they play sound. After that, playback follows the room.</p>
            </div>
          )}
          {room.canControl && room.takes.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 font-body text-sm text-muted">Take
              <select value={take.id} onChange={(e) => control("load", { takeId: e.target.value })} className="panel-inset h-9 max-w-xs rounded-lg px-2 text-ink">
                {room.takes.map((t) => <option key={t.id} value={t.id}>{t.riffTitle}{t.label ? ` · ${t.label}` : ""}</option>)}
              </select>
            </label>
          )}
          {!room.canControl && <p className="font-body text-xs text-muted">The host is controlling playback.</p>}
        </section>
      )}

      {!room.ended && take && (
        <section aria-label="Feedback" className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="React at this moment">
            {ROOM_REACTIONS.map((e) => <button key={e} type="button" onClick={() => send({ emoji: e })} aria-label={`React ${e} at ${fmt(now)}`} className="focus-ring h-10 w-10 rounded-full border border-line text-lg hover:border-copper/60">{e}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send({ body: text }); }} className="flex gap-2">
            <label className="min-w-0 flex-1"><span className="sr-only">Comment at {fmt(now)}</span><input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={`Comment at ${fmt(now)}…`} className="panel-inset h-11 w-full rounded-xl px-3 font-body text-sm outline-none" /></label>
            <Button type="submit" variant="primary" disabled={!text.trim()}>Send</Button>
          </form>
        </section>
      )}
      {error && room && <p role="alert" className="font-body text-sm text-danger">{error}</p>}

      <section aria-label="Timeline of feedback">
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Feedback on this take</h2>
        {current.length === 0 ? <p className="font-body text-sm text-muted">Nothing yet. Comments and reactions are pinned to the moment you send them.</p> : (
          <ol className="divide-y divide-line rounded-xl border border-line">
            {current.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 font-body text-sm">
                <button type="button" disabled={!room.canControl} onClick={() => control("seek", { positionSec: c.atSec })} className="focus-ring w-12 rounded font-mono text-xs text-copper disabled:text-muted" aria-label={`Go to ${fmt(c.atSec)}`}>{fmt(c.atSec)}</button>
                <span className="min-w-0 flex-1">{c.emoji ? <span className="text-lg">{c.emoji}</span> : c.body}</span>
                <span className="text-xs text-muted">@{c.author.handle}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {room.isHost && !room.ended && (
        <section aria-label="Host controls" className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={room.anyoneControls} onChange={async (e) => {
            // Optimistic; the next poll confirms (or reverts) it.
            const anyoneControls = e.target.checked;
            setRoom((r) => r && { ...r, anyoneControls });
            await api(`/api/rooms/${id}`, { method: "PATCH", body: { anyoneControls } }).catch((err) => setError(errorMessage(err)));
            kick.current();
          }} className="accent-copper" /> Anyone can play, pause and seek</label>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { await api(`/api/rooms/${id}`, { method: "PATCH", body: { end: true } }).catch((err) => setError(errorMessage(err))); kick.current(); }}>End session</Button>
        </section>
      )}
    </div>
  );
}
