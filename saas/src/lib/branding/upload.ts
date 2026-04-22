import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'branding'

function extensao(f: File) {
  const n = f.name.toLowerCase()
  if (n.endsWith('.png')) return 'png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'jpg'
  if (n.endsWith('.webp')) return 'webp'
  if (n.endsWith('.svg')) return 'svg'
  return 'jpg'
}

export async function uploadAvatarPublic(supabase: SupabaseClient, userId: string, file: File) {
  const key = `avatars/${userId}/avatar.${extensao(file)}`
  const { error: up } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (up) throw up
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return pub.publicUrl
}

export async function uploadEscritorioLogoPublic(
  supabase: SupabaseClient,
  escritorioId: string,
  file: File,
) {
  const key = `logos/${escritorioId}/logo.${extensao(file)}`
  const { error: up } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (up) throw up
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return pub.publicUrl
}
