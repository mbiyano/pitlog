'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function CustomerSearch({ initialQuery }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const router = useRouter()

  function handleSearch(value: string) {
    setQuery(value)
    const params = value ? `?q=${encodeURIComponent(value)}` : ''
    router.replace(`/clientes${params}`)
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar por nombre, teléfono o email..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10"
      />
    </div>
  )
}
