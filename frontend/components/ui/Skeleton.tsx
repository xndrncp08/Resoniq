/** Placeholder block for loading states; the shimmer stops under reduced motion (globals.css). */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-panel ${className}`} />;
}
