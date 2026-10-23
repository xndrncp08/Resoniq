import Skeleton from "@/components/ui/Skeleton";

/**
 * Shown the moment a link is followed inside the app shell, while the page renders on the server.
 * Next prefetches this boundary for links in view, so navigation responds instantly.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="mt-4 h-10 w-full max-w-md rounded-xl" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl rounded-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}
