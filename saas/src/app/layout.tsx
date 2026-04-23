import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

/** Evita pré-render estático no build (ex.: Vercel sem env) a chamar o cliente Supabase. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'OMNI',
  description: 'Gerencie processos, prazos, clientes e financeiro do seu escritório',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/omni-logo-white.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
