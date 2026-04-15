import { Suspense } from 'react'
import { Loading } from '@/components/shared/loading'

export default function NewVehicleLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}
