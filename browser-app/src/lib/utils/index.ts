export { cn } from './cn'

export function formatPlate(plate: string): string {
  return plate.toUpperCase().trim()
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount)
}

export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat('es-AR').format(km)} km`
}
