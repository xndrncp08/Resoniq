import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-bg px-6 py-32" aria-busy="true" aria-label="Loading your tones">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="mt-4 h-9 w-72 rounded-xl" />
        <Skeleton className="mt-12 h-10 max-w-sm rounded-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      </div>
    </main>
  );
}
