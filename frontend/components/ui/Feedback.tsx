import type { ReactNode } from "react";

// Entrance per tone (keyframes in globals.css): a short shake draws the eye
// to an error; success and notices fade in.
const EFFECTS = { error: "fx-error", success: "fx-success", notice: "fx-notice" } as const;

/**
 * Inline status message with a CSS entrance. Pass a changing
 * `trigger` (e.g. an attempt counter) to replay the animation when the
 * same message shows again, such as a second failed save.
 */
export default function Feedback({
  tone,
  trigger,
  className = "",
  children,
}: {
  tone: keyof typeof EFFECTS;
  trigger?: string | number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      key={trigger}
      role={tone === "error" ? "alert" : "status"}
      className={`${EFFECTS[tone]} ${tone === "error" ? "text-danger" : "text-muted"} ${className}`}
    >
      {children}
    </p>
  );
}
