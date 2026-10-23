"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { IconButton } from "@/components/app/ui";

// Loaded on first use: the dialog (and its animation runtime) isn't needed until someone reports.
const ReportDialog = dynamic(() => import("@/components/social/ReportDialog"), { ssr: false });

export default function ProfileMenu({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <IconButton icon="flag" label="Report this account" onClick={() => { setLoaded(true); setOpen(true); }} />
      {loaded && <ReportDialog open={open} onClose={() => setOpen(false)} targetType="USER" targetId={userId} />}
    </>
  );
}
