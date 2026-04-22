import type { SupabaseClient } from '@supabase/supabase-js'
import type { TipoDfc, TipoLancamento } from '@/types/database'

type SeedRow = {
  codigo: string
  nome: string
  e_sintetica: boolean
  parent: string | null
  ordem: number
  tipo_razao?: TipoLancamento
  natureza_dfc?: TipoDfc
}

const PLANO_SUGERIDO: SeedRow[] = [
  { codigo: '1', nome: 'Receitas', e_sintetica: true, parent: null, ordem: 1 },
  {
    codigo: '1.1',
    nome: 'Honorários e prestação de serviços',
    e_sintetica: false,
    parent: '1',
    ordem: 1,
    tipo_razao: 'receita',
    natureza_dfc: 'operacional',
  },
  {
    codigo: '1.2',
    nome: 'Reembolsos e outras receitas operacionais',
    e_sintetica: false,
    parent: '1',
    ordem: 2,
    tipo_razao: 'receita',
    natureza_dfc: 'operacional',
  },
  {
    codigo: '1.3',
    nome: 'Receitas de financiamento (ex.: empréstimos obtidos)',
    e_sintetica: false,
    parent: '1',
    ordem: 3,
    tipo_razao: 'receita',
    natureza_dfc: 'financiamento',
  },
  { codigo: '2', nome: 'Despesas', e_sintetica: true, parent: null, ordem: 2 },
  {
    codigo: '2.1',
    nome: 'Pessoal e encargos trabalhistas',
    e_sintetica: false,
    parent: '2',
    ordem: 1,
    tipo_razao: 'despesa',
    natureza_dfc: 'operacional',
  },
  {
    codigo: '2.2',
    nome: 'Estrutura, ocupação e utilidades',
    e_sintetica: false,
    parent: '2',
    ordem: 2,
    tipo_razao: 'despesa',
    natureza_dfc: 'operacional',
  },
  {
    codigo: '2.3',
    nome: 'Tecnologia, software e profissional externo',
    e_sintetica: false,
    parent: '2',
    ordem: 3,
    tipo_razao: 'despesa',
    natureza_dfc: 'operacional',
  },
  {
    codigo: '2.4',
    nome: 'Tributos e encargos sobre receita',
    e_sintetica: false,
    parent: '2',
    ordem: 4,
    tipo_razao: 'despesa',
    natureza_dfc: 'operacional',
  },
  {
    codigo: '2.5',
    nome: 'Aquisições e investimentos (ativos, equipamentos)',
    e_sintetica: false,
    parent: '2',
    ordem: 5,
    tipo_razao: 'despesa',
    natureza_dfc: 'investimento',
  },
  {
    codigo: '2.6',
    nome: 'Amortização de empréstimos e despesas financeiras',
    e_sintetica: false,
    parent: '2',
    ordem: 6,
    tipo_razao: 'despesa',
    natureza_dfc: 'financiamento',
  },
]

/** Insere o plano sugerido (escritórios em branco). Lança se alguma inserção falhar. */
export async function seedPlanoContasSugerido(
  supabase: SupabaseClient,
  escritorioId: string,
) {
  const idByCodigo: Record<string, string> = {}
  for (const r of PLANO_SUGERIDO) {
    const { data, error } = await supabase
      .from('plano_contas')
      .insert({
        escritorio_id: escritorioId,
        parent_id: r.parent ? (idByCodigo[r.parent] ?? null) : null,
        codigo: r.codigo,
        nome: r.nome,
        e_sintetica: r.e_sintetica,
        tipo_razao: r.tipo_razao ?? null,
        natureza_dfc: r.natureza_dfc ?? null,
        ordem: r.ordem,
      })
      .select('id, codigo')
      .single()
    if (error) throw error
    idByCodigo[r.codigo] = data.id
  }
}

export const copyPlanoSugerido = () => PLANO_SUGERIDO
