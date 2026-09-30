import { getStaffContext } from '@/lib/staff'
import { hashSecret, json, newSecret, rpcError, sameOrigin } from '@/lib/workflow'
import { z } from 'zod'
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!sameOrigin(request)) return json({ error: 'Nepovolený původ požadavku.' }, 403)
  if (!z.string().uuid().safeParse(params.id).success) return json({ error: 'Neplatné ID.' }, 400)
  try {
    const context = await getStaffContext()
    if (!context.staff) return json({ error: 'Přístup není povolen.' }, context.status)
    const token = newSecret()
    const { data, error } = await context.admin.rpc('tm_staff_action', {
      p_staff: context.staff.id, p_id: params.id, p_action: 'invite', p_data: { token_hash: hashSecret(token) },
    })
    return error ? rpcError(error) : json({ ...data, token })
  } catch { return json({ error: 'Pozvánku se nepodařilo obnovit.' }, 500) }
}
