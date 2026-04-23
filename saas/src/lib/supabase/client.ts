import { createBrowserClient } from '@supabase/ssr'

/**
 * Só chamar a partir de queryFn, mutationFn, handlers, etc. — nunca
 * durante o render, para faltas de env na Vercel não derrubarem a árvore React.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Falta configuração do Supabase: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (ex.: Vercel → Settings → Environment Variables).',
    )
  }
  return createBrowserClient(url, key)
}
