import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'PitLog',
    template: '%s · PitLog',
  },
  description: 'Sistema de gestión para taller mecánico',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-w-[320px]">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
