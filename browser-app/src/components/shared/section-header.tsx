import type { LucideIcon } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
}

export function SectionHeader({ title, description, icon: Icon, actions }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
