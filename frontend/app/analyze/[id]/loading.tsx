import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-bg px-6 py-32" aria-busy="true" aria-label="Loading tone profile">
      <div className="mx-auto max-w-xl text-center">
        <Skeleton className="mx-auto h-3 w-40 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-9 w-64 rounded-xl" />
      </div>
      <div className="mx-auto mt-14 max-w-5xl space-y-6">
        <Skeleton className="h-56" />
        <Skeleton className="h-44" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    </main>
  );
}
