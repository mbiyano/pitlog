'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateVehicle } from '@/lib/services/vehicles'
import type { VehicleFormData } from '@/lib/validations'
import type { Vehicle } from '@/lib/supabase/types'
import { VehicleForm } from '@/components/forms/vehicle-form'
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

export function VehicleEditDialog({ vehicle }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(data: VehicleFormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      await updateVehicle(supabase, vehicle.id, {
        plate: data.plate,
        vin: data.vin ?? null,
        make: data.make ?? null,
        model: data.model ?? null,
        year: data.year ?? null,
        engine: data.engine ?? null,
        mileage_current: data.mileage_current ?? 0,
        notes: data.notes ?? null,
      })
      toast({ title: 'Vehículo actualizado' })
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar vehículo</DialogTitle>
        </DialogHeader>
        <VehicleForm
          defaultValues={{
            customer_id: vehicle.customer_id,
            plate: vehicle.plate,
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            engine: vehicle.engine,
            mileage_current: vehicle.mileage_current,
            notes: vehicle.notes,
          }}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
          loading={loading}
          hideCustomer
        />
      </DialogContent>
    </Dialog>
  )
}
