import Skeleton from "@/components/ui/Skeleton";

/** Instant feedback while an admin page renders on the server. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-64 rounded-xl" />
      <Skeleton className="h-4 w-full max-w-xl rounded-full" />
      <Skeleton className="h-64" />
    </div>
  );
}
