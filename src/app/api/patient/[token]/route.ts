import { createAdminClient } from '@/lib/supabase/server'
import { getPatientSecret, hashSecret, json, newSecret, patientCookieName, patientInput, rpcError, sameOrigin, secretPattern } from '@/lib/workflow'
import { z } from 'zod'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const secret = getPatientSecret(params.token)
  if (!secretPattern.test(params.token) || !secret || !secretPattern.test(secret)) return json({ error: 'Nejprve vyplňte vstupní údaje.' }, 401)
  try {
    const { data, error } = await createAdminClient().rpc('tm_patient_action', {
      p_token_hash: hashSecret(params.token), p_session_hash: hashSecret(secret), p_action: 'status',
    })
    return error ? rpcError(error) : json(data)
  } catch { return json({ error: 'Stav konzultace se nepodařilo načíst.' }, 500) }
}
export async function POST(request: Request, { params }: { params: { token: string } }) {
  if (!sameOrigin(request)) return json({ error: 'Nepovolený původ požadavku.' }, 403)
  if (!secretPattern.test(params.token)) return json({ error: 'Neplatná pozvánka.' }, 403)
  try {
    const body = await request.json().catch(() => null)
    const parsed = z.discriminatedUnion('action', [
      z.object({ action: z.literal('checkin'), data: patientInput }).strict(),
      z.object({ action: z.literal('join'), acknowledged: z.literal(true) }).strict(),
      z.object({ action: z.literal('heartbeat') }).strict(),
    ]).safeParse(body)
    if (!parsed.success) return json({ error: 'Zkontrolujte vyplněné údaje a datum narození.' }, 400)
    const existing = getPatientSecret(params.token)
    if (parsed.data.action !== 'checkin' && (!existing || !secretPattern.test(existing))) return json({ error: 'Nejprve vyplňte vstupní údaje.' }, 401)
    const secret = existing && secretPattern.test(existing) ? existing : newSecret()
    const { data, error } = await createAdminClient().rpc('tm_patient_action', {
      p_token_hash: hashSecret(params.token), p_session_hash: hashSecret(secret), p_action: parsed.data.action,
      p_data: parsed.data.action === 'checkin' ? parsed.data.data : parsed.data.action === 'join' ? { acknowledged: true } : {},
    })
    if (error) return rpcError(error)
    const response = json(data)
    if (parsed.data.action === 'checkin') response.cookies.set(patientCookieName(params.token), secret, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      expires: new Date(data.expires_at),
    })
    return response
  } catch { return json({ error: 'Údaje se nepodařilo uložit. Zkuste to znovu.' }, 500) }
}
