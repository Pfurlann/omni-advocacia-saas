import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { diffDiasCivis, hojeIsoEmBrasil, isoDiaPrazo } from '@/lib/datetime/brazil'

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

/** Datas só-dia (`date` no Postgres / `yyyy-MM-dd`): exibir como dia civil, sem deslocar por UTC. */
export const formatDate = (date: string | Date): string => {
  if (typeof date === 'string') {
    const s = isoDiaPrazo(date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number)
      return format(new Date(y, m - 1, d), 'dd/MM/yyyy', { locale: ptBR })
    }
  }
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })
}

export const formatDateTime = (date: string | Date): string =>
  format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

/** Hora (coluna `time` / input `type="time"`): exibir como HH:mm */
export const formatHoraPrazo = (hora: string | null | undefined): string | null => {
  if (hora == null || String(hora).trim() === '') return null
  const s = String(hora)
  return s.length >= 5 ? s.slice(0, 5) : s
}

/** Valor de `<input type="time">` (HH:MM) → `HH:MM:00` para a coluna `time` do Postgres */
export const horaPrazoParaBanco = (hora: string | null | undefined): string | null => {
  if (hora == null) return null
  const t = String(hora).trim()
  if (t === '') return null
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const h = m[1]!.padStart(2, '0')
    const min = m[2]!
    const sec = m[3] ?? '00'
    return `${h}:${min}:${sec}`
  }
  return t
}

export const formatDateRelative = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })

export const formatDiasRestantes = (date: string | Date): string => {
  const dias = getDiasRestantes(date)
  if (dias < 0) return `${Math.abs(dias)} dias atrás`
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `em ${dias} dias`
}

export const getDiasRestantes = (date: string | Date): number => {
  if (typeof date === 'string') {
    const s = isoDiaPrazo(date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return diffDiasCivis(s, hojeIsoEmBrasil())
    }
  }
  return differenceInDays(new Date(date), new Date())
}

export const getUrgenciaColor = (diasRestantes: number): string => {
  if (diasRestantes < 0) return 'text-red-600 bg-red-50'
  if (diasRestantes <= 3) return 'text-red-600 bg-red-50'
  if (diasRestantes <= 7) return 'text-amber-600 bg-amber-50'
  return 'text-green-600 bg-green-50'
}

export const formatCPF = (cpf: string): string => {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export const formatCNPJ = (cnpj: string): string => {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

/** Formata valor de forma compacta: 1.250.000 → R$ 1,2M | 45.000 → R$ 45k */
export const formatCompact = (value: number): string => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (value >= 1_000)     return `R$ ${(value / 1_000).toFixed(0)}k`
  return formatCurrency(value)
}

export const formatNumeroProcesso = (num: string): string => {
  // Formato: 0000000-00.0000.0.00.0000
  const digits = num.replace(/\D/g, '')
  if (digits.length !== 20) return num
  return digits.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6')
}
