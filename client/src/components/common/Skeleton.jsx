/** Shimmering placeholder used while data loads. */
export default function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-ink-100 ${className}`} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="h-40 rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
