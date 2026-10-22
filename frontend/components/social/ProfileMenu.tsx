"use client";

import { useState } from "react";
import { IconButton } from "@/components/app/ui";
import ReportDialog from "@/components/social/ReportDialog";

export default function ProfileMenu({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="flag" label="Report this account" onClick={() => setOpen(true)} />
      <ReportDialog open={open} onClose={() => setOpen(false)} targetType="USER" targetId={userId} />
    </>
  );
}
