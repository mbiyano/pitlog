'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Car, Loader2, ArrowRight, X } from 'lucide-react'

export function QuickSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; plate: string; make: string | null; model: string | null; customer_name: string }>>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false)
  const requestSequence = useRef(0)
  const router = useRouter()

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) {
      return
    }

    const sequence = ++requestSequence.current
    const timeout = window.setTimeout(async () => {
      setSearching(true)
      setSearchError(false)
      setHasCompletedSearch(false)
      const supabase = createClient()
      const upper = value.toUpperCase()
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate, make, model, customers(full_name)')
        .or(`plate.ilike.%${upper}%,make.ilike.%${value}%,model.ilike.%${value}%`)
        .limit(5)

      if (sequence !== requestSequence.current) return
      setSearching(false)
      setHasCompletedSearch(true)
      if (error) {
        setSearchError(true)
        setResults([])
        return
      }
      setResults(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data ?? []).map((v: any) => ({
          id: v.id,
          plate: v.plate,
          make: v.make,
          model: v.model,
          customer_name: v.customers?.full_name ?? '',
        })),
      )
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [query])

  function updateQuery(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(false)
      setHasCompletedSearch(false)
    }
  }

  const hasPanel = searching || searchError || results.length > 0 || hasCompletedSearch

  return (
    <div className="relative" role="search">
      <label htmlFor="quick-search" className="mb-2 block text-sm font-medium">
        Búsqueda rápida
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="quick-search"
            placeholder="Buscar por patente, marca o modelo..."
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                updateQuery('')
              }
            }}
            aria-expanded={hasPanel}
            aria-controls="quick-search-results"
            className="pl-10 pr-11 text-base"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => updateQuery('')}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (query) router.push(`/vehiculos?q=${encodeURIComponent(query)}`)
          }}
        >
          Ver resultados
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {hasPanel && (
        <div id="quick-search-results" className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border bg-popover shadow-2xl">
          {searching && (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Buscando vehículos…
            </div>
          )}
          {searchError && (
            <p className="p-4 text-center text-sm text-destructive" role="alert">
              No pudimos completar la búsqueda. Intentá nuevamente.
            </p>
          )}
          {hasCompletedSearch && !searchError && results.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No encontramos vehículos con esa búsqueda.
            </p>
          )}
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              className="flex min-h-14 w-full items-center gap-3 border-t px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => {
                router.push(`/vehiculos/${r.id}`)
                updateQuery('')
              }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <span className="font-mono text-sm font-bold">{r.plate}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {r.make} {r.model}
                </span>
                <p className="text-xs text-muted-foreground">{r.customer_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
