"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Dialog from "@/components/app/Dialog";
import { Button, LinkButton } from "@/components/app/ui";
import { useConfirmLeave, useUnsavedChanges } from "@/components/app/UnsavedChanges";
import { api, errorMessage } from "@/lib/client-api";

const field = "panel-inset mt-1.5 w-full rounded-xl px-3 font-body text-[15px] outline-none focus:border-copper/60";

/** Message or invite a musician from their profile. The server decides who's reachable; this shows why not. */
export default function CollabActions({ handle, name, conversationId, reachable }: { handle: string; name: string; conversationId: string | null; reachable: { ok: true } | { ok: false; reason: string } }) {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const [open, setOpen] = useState<"message" | "invite" | null>(null);
  const [text, setText] = useState("");
  const [invite, setInvite] = useState({ title: "", role: "", when: "", where: "", note: "" });
  const dirty = open === "message" ? !!text.trim() : open === "invite" ? Object.values(invite).some((v) => v.trim()) : false;
  useUnsavedChanges({ dirty, label: open === "invite" ? "your invite" : "your message" });
  const close = async () => { if (await confirmLeave()) { setOpen(null); setText(""); setInvite({ title: "", role: "", when: "", where: "", note: "" }); } };

  const message = useMutation({
    mutationFn: () => api<{ conversationId: string }>("/api/conversations", { body: { to: handle, body: text } }),
    onSuccess: ({ conversationId: id }) => { setText(""); setOpen(null); router.push(`/messages/${id}`); },
  });
  const sendInvite = useMutation({
    mutationFn: () => api<{ conversationId: string }>("/api/invites", { body: { to: handle, ...invite } }),
    onSuccess: ({ conversationId: id }) => { setInvite({ title: "", role: "", when: "", where: "", note: "" }); setOpen(null); router.push(`/messages/${id}`); },
  });

  if (!reachable.ok && !conversationId) return <p className="max-w-[16rem] font-body text-xs text-muted">{reachable.reason}</p>;
  return (
    <>
      {conversationId ? (
        <LinkButton href={`/messages/${conversationId}`} icon="comment">Message</LinkButton>
      ) : (
        <Button icon="comment" onClick={() => setOpen("message")}>Message</Button>
      )}
      {reachable.ok && <Button variant="primary" icon="users" onClick={() => setOpen("invite")}>Invite to collaborate</Button>}

      <Dialog open={open === "message"} title={`Message ${name}`} onClose={close}>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) message.mutate(); }} className="space-y-3">
          <label className="block"><span className="label-engraved">Message</span><textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} autoFocus placeholder="Say what you liked, or what you're working on" className={`${field} py-2`} /></label>
          {message.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(message.error)}</p>}
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Button type="submit" variant="primary" disabled={!text.trim() || message.isPending}>{message.isPending ? "Sending…" : "Send"}</Button></div>
        </form>
      </Dialog>

      <Dialog open={open === "invite"} title={`Invite ${name} to collaborate`} onClose={close} wide>
        <form onSubmit={(e) => { e.preventDefault(); if (invite.title.trim()) sendInvite.mutate(); }} className="space-y-3">
          <p className="font-body text-sm text-muted">If they accept, you both get a shared project to swap recordings and feedback.</p>
          <label className="block"><span className="label-engraved">Project</span><input value={invite.title} onChange={(e) => setInvite({ ...invite, title: e.target.value })} required maxLength={80} placeholder="Instrumental prog EP" className={`${field} h-11`} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="label-engraved">Looking for</span><input value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} maxLength={60} placeholder="Drums on 4 tracks" className={`${field} h-11`} /></label>
            <label className="block"><span className="label-engraved">When</span><input value={invite.when} onChange={(e) => setInvite({ ...invite, when: e.target.value })} maxLength={80} placeholder="Over the next month" className={`${field} h-11`} /></label>
            <label className="block"><span className="label-engraved">Where</span><input value={invite.where} onChange={(e) => setInvite({ ...invite, where: e.target.value })} maxLength={80} placeholder="Remote, or Manila" className={`${field} h-11`} /></label>
          </div>
          <label className="block"><span className="label-engraved">Message</span><textarea value={invite.note} onChange={(e) => setInvite({ ...invite, note: e.target.value })} rows={3} maxLength={1000} placeholder="What it sounds like, a reference track, why them" className={`${field} py-2`} /></label>
          {sendInvite.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(sendInvite.error)}</p>}
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Button type="submit" variant="primary" disabled={!invite.title.trim() || sendInvite.isPending}>{sendInvite.isPending ? "Sending…" : "Send invite"}</Button></div>
        </form>
      </Dialog>
    </>
  );
}
