import type { ReactNode } from "react";

const EFFECTS = {
  /** Something went wrong: a short shake draws the eye to the message. */
  error: "headShake",
  /** Something worked. */
  success: "fadeIn",
  /** A new inline message appeared. */
  notice: "fadeInUp",
} as const;

/**
 * Inline status message with an Animate.css entrance. Pass a changing
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
      className={`animated ${EFFECTS[tone]} ${tone === "error" ? "text-danger" : "text-muted"} ${className}`}
    >
      {children}
    </p>
  );
}
