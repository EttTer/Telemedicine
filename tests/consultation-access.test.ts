import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/staff', () => ({ getStaffContext: vi.fn() }))
import { getStaffContext } from '@/lib/staff'
import { GET } from '@/app/api/consultations/[id]/route'

const id = '11111111-1111-4111-8111-111111111111'
const request = new Request(`https://app.example/api/consultations/${id}`)
const context = vi.mocked(getStaffContext)
beforeEach(() => vi.resetAllMocks())

describe('consultation access boundary', () => {
  it.each([401, 403])('rejects unauthorized context %s', async status => {
    context.mockResolvedValue({ status, staff: null, admin: null } as any)
    expect((await GET(request, { params: { id } })).status).toBe(status)
  })
  it('does not fetch a malformed ID', async () => {
    const from = vi.fn()
    context.mockResolvedValue({ status: 200, staff: { practice_id: 'practice-a' }, admin: { from } } as any)
    expect((await GET(request, { params: { id: 'invalid' } })).status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })
  it.each([
    ['practice-a', 200],
    ['practice-b', 404],
  ])('returns a consultation from %s with status %s', async (recordPractice, expectedStatus) => {
    const filters: Record<string, string> = {}
    const query: any = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: string) => { filters[key] = value; return query }),
      single: vi.fn(async () => ({
        data: filters.id === id && filters.practice_id === recordPractice ? { id, practice_id: recordPractice } : null,
        error: null,
      })),
    }
    context.mockResolvedValue({ status: 200, staff: { practice_id: 'practice-a' }, admin: { from: () => query } } as any)
    const response = await GET(request, { params: { id } })
    expect(response.status).toBe(expectedStatus)
    expect(filters).toEqual({ id, practice_id: 'practice-a' })
    if (expectedStatus === 200) expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
