"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app/ui";
import { api } from "@/lib/client-api";
import { useServerToggle } from "@/lib/queries/toggle";

/** Follow / join style toggles: PUT to turn on, DELETE to turn off, optimistic with rollback. */
export default function ToggleButton({ url, initial, on, off, signedIn, size = "md" }: { url: string; initial: boolean; on: string; off: string; signedIn: boolean; size?: "sm" | "md" }) {
  const router = useRouter();
  const { on: active, toggle: flip } = useServerToggle({ scope: url, initial, send: (next) => api(url, { method: next ? "PUT" : "DELETE" }), onSettled: () => router.refresh() });
  const [hover, setHover] = useState(false);
  const toggle = () => (signedIn ? flip() : router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname)}`));
  return (
    <Button size={size} variant={active ? "secondary" : "primary"} onClick={toggle} aria-pressed={active} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {active ? (hover ? `Un${on.toLowerCase().replace(/ing$/, "")}` : on) : off}
    </Button>
  );
}
