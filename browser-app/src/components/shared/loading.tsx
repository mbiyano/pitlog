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
