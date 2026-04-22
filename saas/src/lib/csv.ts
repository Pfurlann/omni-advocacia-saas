const SEP = ';' /** Separador padrão pt-BR (Excel) */

function escapeField(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export type OmniCsvTable = {
  title?: string
  /** Primeira linha: cabeçalhos. */
  headers: string[]
  /** Cada linha: mesma ordem que headers. Números e datas serão stringificados. */
  rows: (string | number | null | undefined)[][]
}

/**
 * Gera conteúdo CSV com separador `;`, aspas conforme RFC 4180 e BOM UTF-8 para o Excel.
 */
export function buildOmniCsvString(table: OmniCsvTable): string {
  const lines: string[] = []
  if (table.title) {
    lines.push(escapeField(`OMNI — ${table.title}`))
    lines.push('') // linha vazia após título
  }
  lines.push(table.headers.map(h => escapeField(String(h))).join(SEP))
  for (const row of table.rows) {
    lines.push(
      table.headers.map((_, i) => escapeField(String(row[i] ?? ''))).join(SEP),
    )
  }
  return lines.join('\n')
}

export function downloadOmniCsvFile(filename: string, csvContent: string) {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function buildOmniCsvAndDownload(
  baseFileName: string,
  table: OmniCsvTable,
) {
  const s = buildOmniCsvString(table)
  const name = `omni_${baseFileName}_${new Date().toISOString().slice(0, 10)}.csv`
  downloadOmniCsvFile(name, s)
}
