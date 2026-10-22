"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/ui";
import { api } from "@/lib/client-api";

/** Follow / join style toggles: PUT to turn on, DELETE to turn off, optimistic with rollback. */
export default function ToggleButton({ url, initial, on, off, signedIn, size = "md" }: { url: string; initial: boolean; on: string; off: string; signedIn: boolean; size?: "sm" | "md" }) {
  const router = useRouter();
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  async function toggle() {
    if (!signedIn) return router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
    setBusy(true);
    setActive(!active);
    try {
      await api(url, { method: active ? "DELETE" : "PUT" });
      router.refresh();
    } catch {
      setActive(active);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size={size} variant={active ? "secondary" : "primary"} onClick={toggle} disabled={busy} aria-pressed={active} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {active ? (hover ? `Un${on.toLowerCase().replace(/ing$/, "")}` : on) : off}
    </Button>
  );
}
