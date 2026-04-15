'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createCustomer } from '@/lib/services/customers'
import type { CustomerFormData } from '@/lib/validations'
import { PageHeader } from '@/components/layout/page-header'
import { CustomerForm } from '@/components/forms/customer-form'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

export default function NewCustomerPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(data: CustomerFormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      const customer = await createCustomer(supabase, {
        full_name: data.full_name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        notes: data.notes ?? null,
      })
      toast({ title: 'Cliente creado', description: customer.full_name })
      router.push(`/clientes/${customer.id}`)
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo crear el cliente', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo cliente" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <CustomerForm onSubmit={handleSubmit} submitLabel="Crear cliente" loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
