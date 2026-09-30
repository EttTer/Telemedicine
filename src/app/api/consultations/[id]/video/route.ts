import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getStaffContext } from '@/lib/staff'
import { createWherebyMeeting, deleteWherebyMeeting } from '@/lib/video'
import { json, rpcError, sameOrigin } from '@/lib/workflow'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) return json({ error: 'Neplatné ID.' }, 400)
  try {
    const context = await getStaffContext()
    if (!context.staff) return json({ error: 'Přístup není povolen.' }, context.status)
    const { data, error } = await context.admin.rpc('tm_staff_action', { p_staff: context.staff.id, p_id: params.id, p_action: 'room' })
    return error ? rpcError(error) : json({ status: data.status, hostRoomUrl: data.hostRoomUrl })
  } catch { return json({ error: 'Hovor není dostupný.' }, 500) }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!sameOrigin(request)) return json({ error: 'Nepovolený původ požadavku.' }, 403)
  if (!z.string().uuid().safeParse(params.id).success) return json({ error: 'Neplatné ID.' }, 400)
  try {
    const body = z.object({ action: z.enum(['start','end']) }).strict().safeParse(await request.json().catch(() => null))
    if (!body.success) return json({ error: 'Neplatná akce.' }, 400)
    const context = await getStaffContext()
    if (!context.staff) return json({ error: 'Přístup není povolen.' }, context.status)
    const rpc = (action: string, data = {}) => context.admin.rpc('tm_staff_action', { p_staff: context.staff.id, p_id: params.id, p_action: action, p_data: data })
    if (body.data.action === 'end') {
      const room = await rpc('room')
      if (room.error) return rpcError(room.error)
      if (room.data.status !== 'completed') {
        if (!room.data.meetingId) return json({ error: 'Chybí identifikátor hovoru. Kontaktujte správce.' }, 409)
        await deleteWherebyMeeting(room.data.meetingId)
      }
      const ended = await rpc('end')
      return ended.error ? rpcError(ended.error) : json({ status: 'completed' })
    }
    // Check authorization before configuration feedback. The database serializes competing starts.
    const claimId = randomUUID()
    const claimed = await rpc('claim', { claim_id: claimId })
    if (claimed.error) return rpcError(claimed.error)
    if (claimed.data.hostRoomUrl) return json({ hostRoomUrl: claimed.data.hostRoomUrl })
    let meeting: Awaited<ReturnType<typeof createWherebyMeeting>> | undefined
    try {
      if (!process.env.WHEREBY_API_KEY) return json({ error: 'Videohovor ještě není nakonfigurovaný. Správce musí v Netlify nastavit WHEREBY_API_KEY z Whereby Embedded.' }, 503)
      const expiry = new Date(Date.now() + 2 * 60 * 60 * 1000)
      meeting = await createWherebyMeeting(expiry)
      const started = await rpc('start', { ...meeting, expiry: expiry.toISOString(), claim_id: claimId })
      if (started.error) {
        await deleteWherebyMeeting(meeting.meetingId)
        meeting = undefined
        return rpcError(started.error)
      }
      return json({ hostRoomUrl: meeting.hostRoomUrl })
    } catch {
      if (meeting) await deleteWherebyMeeting(meeting.meetingId).catch(() => undefined)
      return json({ error: 'Whereby hovor se nepodařilo připravit. Zkontrolujte konfiguraci služby a zkuste to znovu.' }, 502)
    } finally { await rpc('release', { claim_id: claimId }) }
  } catch { return json({ error: 'Operace hovoru se nezdařila. Zkuste ji znovu.' }, 502) }
}
