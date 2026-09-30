import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createWherebyMeeting, deleteWherebyMeeting } from '@/lib/video'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Whereby server adapter', () => {
  it('requires the API key before making a request', async () => {
    vi.stubEnv('WHEREBY_API_KEY', '')
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(createWherebyMeeting(new Date(Date.now() + 60000))).rejects.toThrow('WHEREBY_API_KEY')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('creates a locked room with separate guest and host URLs', async () => {
    vi.stubEnv('WHEREBY_API_KEY', 'test-key')
    const meeting = { meetingId: '123', roomUrl: 'https://test.whereby.com/room', hostRoomUrl: 'https://test.whereby.com/room?roomKey=test' }
    const fetch = vi.fn().mockResolvedValue(Response.json(meeting)); vi.stubGlobal('fetch', fetch)
    expect(await createWherebyMeeting(new Date(Date.now() + 60000))).toEqual(meeting)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('https://api.whereby.dev/v1/meetings')
    expect(JSON.parse(options.body)).toMatchObject({ isLocked: true, fields: ['hostRoomUrl'], roomMode: 'normal' })
  })
  it('does not expose provider response secrets in errors', async () => {
    vi.stubEnv('WHEREBY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive-provider-detail', { status: 401 })))
    await expect(createWherebyMeeting(new Date(Date.now() + 60000))).rejects.toThrow('Whereby meeting creation failed (401)')
  })
  it('rejects a room URL outside Whereby', async () => {
    vi.stubEnv('WHEREBY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ meetingId: '123', roomUrl: 'https://attacker.example/room', hostRoomUrl: 'https://test.whereby.com/room' })))
    await expect(createWherebyMeeting(new Date(Date.now() + 60000))).rejects.toThrow()
  })
  it('deletes the specific room', async () => {
    vi.stubEnv('WHEREBY_API_KEY', 'test-key')
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch)
    await deleteWherebyMeeting('123')
    expect(fetch).toHaveBeenCalledWith('https://api.whereby.dev/v1/meetings/123', expect.objectContaining({ method: 'DELETE' }))
  })
})
