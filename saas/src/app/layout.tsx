import type { Metadata } from 'next'
import { Inter, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

// UI font — leitura densa de dados jurídicos
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Display font — autoridade, prestígio, títulos de alto impacto
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

/** Evita pré-render estático no build (ex.: Vercel sem env) a chamar o cliente Supabase. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'OMNI',
  description: 'Gerencie processos, prazos, clientes e financeiro do seu escritório',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${dmSerif.variable} ${inter.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
