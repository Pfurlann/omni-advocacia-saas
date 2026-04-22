import { Resend } from 'resend'

const resendKey = process.env.RESEND_API_KEY
const from = process.env.RESEND_FROM_EMAIL?.trim() || 'LexFlow <onboarding@resend.dev>'

export async function enviarEmailLembretesPrazos(opts: {
  to: string
  items: { titulo: string; dataPrazo: string; processoTitulo: string | null; dias: number }[]
}): Promise<{ ok: boolean; error?: string }> {
  if (!resendKey) {
    return { ok: false, error: 'RESEND_API_KEY não configurada' }
  }
  const resend = new Resend(resendKey)
  const rows = opts.items
    .map(
      i =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.titulo)}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.processoTitulo ? escapeHtml(i.processoTitulo) : '—'}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.dataPrazo}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.dias} dia(s)</td></tr>`,
    )
    .join('')

  const html = `
    <p>Você tem <strong>${opts.items.length}</strong> prazo(s) próximo(s) no LexFlow:</p>
    <table style="border-collapse:collapse;width:100%;max-width:560px;font-size:14px">
      <thead><tr style="background:#f4f4f5;text-align:left"><th style="padding:8px">Prazo</th><th style="padding:8px">Processo</th><th style="padding:8px">Data</th><th style="padding:8px">Faltam</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px;font-size:13px;color:#666">Acesse o LexFlow para conferir os detalhes.</p>
  `

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: `[LexFlow] ${opts.items.length} prazo(s) próximo(s)`,
    html,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
