/**
 * Sincroniza o prazo com o Google (servidor) — falhas são ignoradas no cliente
 * (ex.: responsável ainda sem Google ligado).
 */
export async function triggerSyncPrazo(prazoId: string) {
  try {
    const r = await fetch('/api/google-calendar/sync-prazo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prazoId }),
      credentials: 'include',
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      console.warn('sync prazo', r.status, t)
    }
  } catch (e) {
    console.warn('sync prazo', e)
  }
}
