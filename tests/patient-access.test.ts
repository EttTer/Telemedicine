import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
import { createAdminClient } from '@/lib/supabase/server'
import { getPatientConsultation } from '@/lib/patient-access'
const admin = vi.mocked(createAdminClient)
beforeEach(() => vi.resetAllMocks())

describe('patient invitation boundary', () => {
  it('rejects consultation IDs without database access', async () => {
    expect(await getPatientConsultation('11111111-1111-4111-8111-111111111111')).toBeNull()
    expect(admin).not.toHaveBeenCalled()
  })
  it.each([true, false])('checks hash, expiry, used flag and consultation status (valid=%s)', async valid => {
    const filters: Record<string, any> = {}
    const from = vi.fn((table: string) => {
      const query: any = {
        select: () => query,
        eq: (key: string, value: any) => { filters[`${table}.${key}`] = value; return query },
        gt: (key: string, value: any) => { filters[`${table}.${key}`] = value; return query },
        in: (key: string, value: any) => { filters[`${table}.${key}`] = value; return query },
        maybeSingle: async () => ({data:null,error:null}),
        single: async () => ({ data: table === 'consultation_tokens' ? (valid ? { consultation_id: 'consultation-a' } : null) : { id: 'consultation-a' }, error: null }),
      }
      return query
    })
    admin.mockReturnValue({ from } as any)
    const token = 'a'.repeat(64)
    const result = await getPatientConsultation(token)
    expect(filters['consultation_tokens.token_hash']).toBe(createHash('sha256').update(token).digest('hex'))
    expect(filters['consultation_tokens.is_used']).toBe(false)
    expect(Number.isFinite(Date.parse(filters['consultation_tokens.expires_at']))).toBe(true)
    if (valid) {
      expect(result).toEqual({ id: 'consultation-a',profile:{},practitioner:null,instructionHash:expect.stringMatching(/^[a-f0-9]{64}$/) })
      expect(filters['consultations.id']).toBe('consultation-a')
      expect(filters['consultations.status']).toEqual(['scheduled', 'waiting', 'in_progress'])
    } else {
      expect(result).toBeNull()
      expect(from).toHaveBeenCalledTimes(1)
    }
  })
})
