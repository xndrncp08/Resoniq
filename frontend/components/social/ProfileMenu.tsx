"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { IconButton } from "@/components/app/ui";
import { api } from "@/lib/client-api";

// Loaded on first use: the dialog (and its animation runtime) isn't needed until someone reports.
const ReportDialog = dynamic(() => import("@/components/social/ReportDialog"), { ssr: false });

/** Report or block from a profile. Blocking stops messages both ways and hides your direct conversation. */
export default function ProfileMenu({ userId, handle, blocked: initialBlocked = false }: { userId: string; handle: string; blocked?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  const block = useMutation({
    mutationFn: (next: boolean) => api(`/api/users/${handle}/block`, { method: next ? "PUT" : "DELETE" }),
    onMutate: (next) => setBlocked(next),
    onError: (_e, next) => setBlocked(!next),
    onSuccess: () => router.refresh(),
  });
  return (
    <>
      <IconButton icon="ban" label={blocked ? `Unblock @${handle}` : `Block @${handle}`} active={blocked} disabled={block.isPending} onClick={() => block.mutate(!blocked)} />
      <IconButton icon="flag" label="Report this account" onClick={() => { setLoaded(true); setOpen(true); }} />
      {loaded && <ReportDialog open={open} onClose={() => setOpen(false)} targetType="USER" targetId={userId} />}
    </>
  );
}
