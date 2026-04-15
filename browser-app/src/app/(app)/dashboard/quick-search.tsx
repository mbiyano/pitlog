'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Car } from 'lucide-react'

export function QuickSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; plate: string; make: string | null; model: string | null; customer_name: string }>>([])
  const [searching, setSearching] = useState(false)
  const router = useRouter()

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    const supabase = createClient()
    const upper = value.toUpperCase()

    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, make, model, customers(full_name)')
      .or(`plate.ilike.%${upper}%,make.ilike.%${value}%,model.ilike.%${value}%`)
      .limit(5)

    setResults(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).map((v: any) => ({
        id: v.id,
        plate: v.plate,
        make: v.make,
        model: v.model,
        customer_name: v.customers?.full_name ?? '',
      }))
    )
    setSearching(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por patente, marca o modelo..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 text-base"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (query) router.push(`/vehiculos?q=${encodeURIComponent(query)}`)
          }}
        >
          Buscar
        </Button>
      </div>

      {results.length > 0 && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border bg-popover shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
              onClick={() => {
                router.push(`/vehiculos/${r.id}`)
                setQuery('')
                setResults([])
              }}
            >
              <Car className="h-5 w-5 text-muted-foreground" />
              <div>
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

      {searching && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border bg-popover p-4 text-center shadow-lg">
          <p className="text-sm text-muted-foreground">Buscando...</p>
        </div>
      )}
    </div>
  )
}
