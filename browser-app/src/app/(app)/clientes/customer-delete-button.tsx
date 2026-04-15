'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'

interface CustomerDeleteButtonProps {
  customerId: string
  customerName: string
  vehicleCount: number
  /** When set, navigates to this path after successful deletion instead of refreshing. */
  redirectTo?: string
}

export function CustomerDeleteButton({
  customerId,
  customerName,
  vehicleCount,
  redirectTo,
}: CustomerDeleteButtonProps) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('customers').delete().eq('id', customerId)
      if (error) throw error

      toast({ title: 'Cliente eliminado', description: customerName })
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el cliente',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
          <AlertDialogDescription>
            {vehicleCount > 0 ? (
              <>
                <span className="font-semibold text-foreground">{customerName}</span> tiene{' '}
                <span className="font-semibold text-foreground">
                  {vehicleCount} {vehicleCount === 1 ? 'vehículo asociado' : 'vehículos asociados'}
                </span>
                . Al eliminar el cliente, también se eliminarán todos sus vehículos y registros
                relacionados. Esta acción no se puede deshacer.
              </>
            ) : (
              <>
                Se eliminará a{' '}
                <span className="font-semibold text-foreground">{customerName}</span>. Esta acción
                no se puede deshacer.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
