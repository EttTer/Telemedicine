import 'server-only'
import { z } from 'zod'

const wherebyUrl = z.string().url().refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && url.hostname.endsWith('.whereby.com')
})
const meetingSchema = z.object({
  meetingId: z.union([z.string(), z.number()]).transform(String),
  roomUrl: wherebyUrl,
  hostRoomUrl: wherebyUrl,
})

function authorization() {
  const key = process.env.WHEREBY_API_KEY
  if (!key) throw new Error('WHEREBY_API_KEY is missing')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

// Server-only adapter. Do not return hostRoomUrl to patients or place it in logs.
// Room routes and lifecycle persistence will be connected in the next milestone.
export async function createWherebyMeeting(endDate: Date) {
  if (!Number.isFinite(endDate.getTime()) || endDate.getTime() <= Date.now()) {
    throw new Error('Meeting endDate must be in the future')
  }
  const response = await fetch('https://api.whereby.dev/v1/meetings', {
    method: 'POST',
    headers: authorization(),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      endDate: endDate.toISOString(),
      roomMode: 'normal',
      isLocked: true,
      roomNamePrefix: 'consultation',
      fields: ['hostRoomUrl'],
    }),
  })
  if (!response.ok) throw new Error(`Whereby meeting creation failed (${response.status})`)
  return meetingSchema.parse(await response.json())
}

export async function deleteWherebyMeeting(meetingId: string) {
  if (!meetingId) throw new Error('Meeting ID is required')
  const response = await fetch(`https://api.whereby.dev/v1/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
    headers: authorization(),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Whereby meeting deletion failed (${response.status})`)
}
