const ZAPSIGN_URL = 'https://api.zapsign.com.br/api/v1/docs/'

export type CriarDocZapSignInput = {
  name: string
  base64Pdf: string
  externalId: string
  signers: Array<{
    name: string
    email: string
    phone_country?: string
    phone_number?: string
    auth_mode?: string
  }>
}

export type CriarDocZapSignResult =
  | { ok: true; token: string; status: string; signUrl: string | null }
  | { ok: false; error: string }

export async function criarDocumentoZapSign(input: CriarDocZapSignInput): Promise<CriarDocZapSignResult> {
  const apiKey = process.env.ZAPSIGN_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'ZAPSIGN_API_KEY não configurada' }
  }

  const signers = input.signers.map(s => {
    const base: Record<string, unknown> = {
      name: s.name,
      email: s.email,
      auth_mode: s.auth_mode ?? 'assinaturaTela-tokenEmail',
      send_automatic_email: true,
    }
    const pn = s.phone_number?.replace(/\D/g, '') ?? ''
    if (pn.length >= 10) {
      base.phone_country = s.phone_country ?? '55'
      base.phone_number = pn.startsWith('55') ? pn.slice(2) : pn
    }
    return base
  })

  const body = {
    name: input.name.slice(0, 255),
    base64_pdf: input.base64Pdf,
    lang: 'pt-br',
    external_id: input.externalId,
    signers,
  }

  const res = await fetch(ZAPSIGN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    return { ok: false, error: text.slice(0, 300) || 'Resposta inválida da ZapSign' }
  }

  if (!res.ok) {
    const err = typeof json.detail === 'string' ? json.detail : text.slice(0, 300)
    return { ok: false, error: err || res.statusText }
  }

  const token = String(json.token ?? '')
  const status = String(json.status ?? 'pending')
  const signersArr = json.signers as Array<{ sign_url?: string }> | undefined
  const signUrl = signersArr?.[0]?.sign_url ? String(signersArr[0].sign_url) : null

  if (!token) {
    return { ok: false, error: 'ZapSign não retornou token do documento' }
  }

  return { ok: true, token, status, signUrl }
}
