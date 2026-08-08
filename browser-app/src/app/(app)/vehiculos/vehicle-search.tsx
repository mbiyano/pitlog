'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function VehicleSearch({ initialQuery }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const router = useRouter()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = query.trim()
      const params = normalized ? `?q=${encodeURIComponent(normalized)}` : ''
      router.replace(`/vehiculos${params}`, { scroll: false })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [query, router])

  return (
    <div className="relative max-w-2xl" role="search">
      <label htmlFor="vehicle-search" className="sr-only">Buscar vehículos</label>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="vehicle-search"
        placeholder="Buscar por patente, marca o modelo..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 pr-11"
      />
      {query && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0"
          onClick={() => setQuery('')}
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
