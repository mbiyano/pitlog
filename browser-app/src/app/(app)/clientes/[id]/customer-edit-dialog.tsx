'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateCustomer } from '@/lib/services/customers'
import type { CustomerFormData } from '@/lib/validations'
import type { Customer } from '@/lib/supabase/types'
import { CustomerForm } from '@/components/forms/customer-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Pencil } from 'lucide-react'

export function CustomerEditDialog({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(data: CustomerFormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      await updateCustomer(supabase, customer.id, {
        full_name: data.full_name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        notes: data.notes ?? null,
      })
      toast({ title: 'Cliente actualizado' })
      setOpen(false)
      router.refresh()
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <CustomerForm
          defaultValues={{
            full_name: customer.full_name,
            phone: customer.phone,
            email: customer.email,
            notes: customer.notes,
          }}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  )
}
