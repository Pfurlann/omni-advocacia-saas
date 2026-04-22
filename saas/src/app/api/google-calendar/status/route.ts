import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 })
  }
  const { data: row } = await supabase
    .from('user_google_calendar')
    .select(
      'default_calendar_id, visible_calendar_ids, show_omni_layer, updated_at, omni_sync_calendar_id, omni_sync_calendar_name, omni_sync_calendar_color_id',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ connected: false })
  }
  return NextResponse.json({
    connected: true,
    defaultCalendarId: row.default_calendar_id ?? 'primary',
    visibleCalendarIds: row.visible_calendar_ids ?? ['primary'],
    showOmniLayer: row.show_omni_layer,
    updatedAt: row.updated_at,
    omniSyncCalendarId: row.omni_sync_calendar_id ?? null,
    omniSyncCalendarName: row.omni_sync_calendar_name ?? null,
    omniSyncCalendarColorId: row.omni_sync_calendar_color_id ?? null,
  })
}
