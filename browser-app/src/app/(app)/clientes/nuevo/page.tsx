'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createCustomer } from '@/lib/services/customers'
import type { CustomerFormData } from '@/lib/validations'
import { PageHeader } from '@/components/layout/page-header'
import { CustomerForm } from '@/components/forms/customer-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear el cliente', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clientes"
        title="Nuevo cliente"
        description="Registrá los datos básicos. Solo el nombre es obligatorio."
        actions={
          <Button asChild variant="outline">
            <Link href="/clientes">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver
            </Link>
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Datos de contacto</CardTitle>
          <CardDescription>Esta información se usa para asociar vehículos y recordatorios.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm onSubmit={handleSubmit} submitLabel="Crear cliente" loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
