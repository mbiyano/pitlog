import { Sidebar } from '@/components/layout/sidebar'

export const dynamic = 'force-dynamic'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
      >
        Ir al contenido
      </a>
      <Sidebar />
      <main id="main-content" className="min-w-0 flex-1 pt-16 lg:pt-0" tabIndex={-1}>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          {children}
        </div>
      </main>
    </div>
  )
}
