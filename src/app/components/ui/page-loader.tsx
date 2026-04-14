import { Skeleton } from "./skeleton";
import { cn } from "./utils";

// ─────────────────────────────────────────────────────────────
// PageLoader — full-page contextual loading screen
// Usage: <PageLoader title="Loading your dashboard…" description="Fetching clients, projects & revenue" />
// ─────────────────────────────────────────────────────────────
interface PageLoaderProps {
  title?: string;
  description?: string;
  className?: string;
}

export function PageLoader({ title, description, className }: PageLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center min-h-[60vh]", className)}>
      <div className="text-center space-y-4 max-w-xs">
        {/* Pulsing rings */}
        <div className="relative mx-auto w-14 h-14">
          <span className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <span className="absolute inset-0 rounded-full border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent animate-spin" />
        </div>
        {title && (
          <p className="text-sm font-medium text-foreground">{title}</p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonCard — single stat/metric card placeholder
// ─────────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="bg-card border rounded-xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonCards — grid of stat cards
// ─────────────────────────────────────────────────────────────
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonInfoCard — tall card with title + field rows (Contact Info / Lead Info style)
// ─────────────────────────────────────────────────────────────
export function SkeletonInfoCard({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border rounded-xl flex flex-col min-h-[300px]">
      {/* Card header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      {/* Field rows */}
      <div className="px-6 py-4 flex-1 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className={cn("h-4", i % 3 === 0 ? "w-40" : i % 3 === 1 ? "w-32" : "w-48")} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonTable — table rows placeholder
// ─────────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-muted/40 px-6 py-3 flex gap-6 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-6 py-4 flex gap-6 items-center border-b last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                "h-3",
                c === 0 ? "w-32" : c === 1 ? "w-24" : c === 2 ? "w-28" : "w-16"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonList — vertical list of items (notes, activity log, etc.)
// ─────────────────────────────────────────────────────────────
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 border rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonDetailHeader — client/project detail header
// ─────────────────────────────────────────────────────────────
export function SkeletonDetailHeader() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      {/* Stat cards row */}
      <SkeletonCards count={4} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonChart — chart area placeholder
// ─────────────────────────────────────────────────────────────
export function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div className="bg-card border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div
        className="w-full rounded-lg bg-muted/30 animate-pulse flex items-end gap-2 px-4 pb-4 pt-8"
        style={{ height }}
      >
        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/20 rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonSearch — search input placeholder
// ─────────────────────────────────────────────────────────────
export function SkeletonSearch({ wide = false }: { wide?: boolean }) {
  return (
    <div className={wide ? "w-full" : "max-w-md w-full"}>
      <div className="relative flex items-center">
        <Skeleton className="h-10 w-full rounded-md" />
        {/* ghost search icon inside the bar */}
        <div className="absolute left-3 h-4 w-4 rounded-sm bg-muted-foreground/10" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonPayrollRow — payroll list item
// ─────────────────────────────────────────────────────────────
export function SkeletonPayrollRow() {
  return (
    <div className="flex items-center justify-between p-4 border rounded-xl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex gap-6 items-center">
        <div className="space-y-1 text-right">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonFIOCard — FIO / crew payment card
// ─────────────────────────────────────────────────────────────
export function SkeletonFIOCard() {
  return (
    <div className="border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {["Total Labor", "Paid", "Remaining"].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}
