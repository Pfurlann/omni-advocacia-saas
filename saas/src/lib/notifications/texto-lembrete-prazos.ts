export function textoLembretePrazosWhatsapp(items: { titulo: string; dataPrazo: string; processoTitulo: string | null; dias: number }[]): string {
  const linhas = items.map(i => {
    const proc = i.processoTitulo ? ` [${i.processoTitulo}]` : ''
    return `• ${i.titulo}${proc} — ${i.dataPrazo} (em ${i.dias} dia(s))`
  })
  return `*LexFlow — Prazos próximos*\n\n${linhas.join('\n')}\n\n_Acesse o painel para detalhes._`
}
