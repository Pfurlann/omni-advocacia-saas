/**
 * Z-API (https://developer.z-api.io) — envio de texto via WhatsApp Business.
 * Variáveis: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (Client-Token do painel).
 */

const MAX_MSG = 3800

export function telefoneParaZApi(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const d = raw.replace(/\D/g, '')
  if (d.length >= 10 && d.length <= 11) return `55${d}`
  if (d.startsWith('55') && d.length >= 12 && d.length <= 13) return d
  return null
}

export async function enviarTextoZApi(opts: { phone: string; message: string }): Promise<{ ok: boolean; error?: string }> {
  const id = process.env.ZAPI_INSTANCE_ID?.trim()
  const token = process.env.ZAPI_TOKEN?.trim()
  const clientToken = process.env.ZAPI_CLIENT_TOKEN?.trim()
  if (!id || !token || !clientToken) {
    return { ok: false, error: 'Z-API não configurada (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)' }
  }

  const url = `https://api.z-api.io/instances/${id}/token/${token}/send-text`
  const msg = opts.message.length > MAX_MSG ? `${opts.message.slice(0, MAX_MSG - 20)}…` : opts.message

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken,
    },
    body: JSON.stringify({
      phone: opts.phone,
      message: msg,
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    return { ok: false, error: text.slice(0, 200) || res.statusText }
  }
  return { ok: true }
}
