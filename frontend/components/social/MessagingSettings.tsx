"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Avatar, Button } from "@/components/app/ui";
import { SaveStatus, saveState } from "@/components/app/UnsavedChanges";
import { api, errorMessage } from "@/lib/client-api";
import { DM_POLICIES, type DmPolicyId } from "@/lib/portfolio-options";

type Blocked = { id: string; handle: string; name: string | null; image: string | null };

/** Who can start a conversation with you, and the people you've blocked. Saves on change. */
export default function MessagingSettings({ initial, blocked: initialBlocked }: { initial: DmPolicyId; blocked: Blocked[] }) {
  const [policy, setPolicy] = useState(initial);
  const [blocked, setBlocked] = useState(initialBlocked);
  const save = useMutation({ mutationFn: (dmPolicy: DmPolicyId) => api("/api/me", { method: "PATCH", body: { dmPolicy } }) });
  const unblock = useMutation({
    mutationFn: (handle: string) => api(`/api/users/${handle}/block`, { method: "DELETE" }),
    onSuccess: (_r, handle) => setBlocked((b) => b.filter((u) => u.handle !== handle)),
  });

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="font-body text-sm font-medium text-ink">Who can start a conversation with you</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
          {DM_POLICIES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={policy === p.id} disabled={save.isPending}
              onClick={() => { const prev = policy; setPolicy(p.id); save.mutate(p.id, { onError: () => setPolicy(prev) }); }}
              className={`focus-ring rounded-full border px-3.5 py-2 font-body text-sm ${policy === p.id ? "border-copper bg-copper/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 font-body text-xs text-muted">People already in a conversation with you can keep replying. Collaboration invites count as messages.</p>
        <SaveStatus state={saveState(save, false)} error={save.error ? errorMessage(save.error) : null} className="mt-1" />
      </fieldset>
      <div>
        <p className="font-body text-sm font-medium text-ink">Blocked</p>
        {blocked.length ? (
          <ul className="mt-2 space-y-1.5">
            {blocked.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                <Avatar user={u} size={28} />
                <span className="min-w-0 flex-1 truncate font-body text-sm">{u.name ?? u.handle} <span className="font-mono text-xs text-muted">@{u.handle}</span></span>
                <Button size="sm" variant="ghost" disabled={unblock.isPending} onClick={() => unblock.mutate(u.handle)}>Unblock</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-body text-xs text-muted">No one. Block someone from their profile: neither of you can message the other.</p>
        )}
      </div>
    </div>
  );
}
