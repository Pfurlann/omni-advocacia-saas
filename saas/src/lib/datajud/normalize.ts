/** Só os dígitos do campo, sem validar quantidade. */
export function digitsOnlyCnj(input: string | null | undefined): string {
  if (!input?.trim()) return ''
  return input.replace(/\D/g, '')
}

/** Conta dígitos (após remover pontuação). */
export function countCnjDigits(input: string | null | undefined): number {
  return digitsOnlyCnj(input).length
}

/** Remove formatação e deixa só dígitos do número CNJ (20 caracteres). */
export function normalizeNumeroCnj(input: string | null | undefined): string | null {
  const digits = digitsOnlyCnj(input)
  if (digits.length !== 20) return null
  return digits
}
