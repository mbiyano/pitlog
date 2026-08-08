import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-3 py-12" role="status" aria-live="polite">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <span className="text-sm text-muted-foreground">Cargando…</span>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando la vista"
    >
      <span className="sr-only">Cargando la vista…</span>

      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-52 max-w-full sm:w-64" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full sm:w-36" />
      </div>

      <Skeleton className="h-11 w-full" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <Card key={groupIndex} className="space-y-4 p-5 sm:p-6">
            <Skeleton className="h-6 w-40 max-w-full" />
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <Skeleton key={rowIndex} className="h-14 w-full" />
            ))}
          </Card>
        ))}
      </div>
    </div>
  )
}
