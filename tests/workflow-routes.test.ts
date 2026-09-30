import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ cookie: undefined as string | undefined, rpc: vi.fn(), context: vi.fn(), createMeeting: vi.fn(), deleteMeeting: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => mocks.cookie ? { value: mocks.cookie } : undefined }) }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/staff', () => ({ getStaffContext: mocks.context }))
vi.mock('@/lib/video', () => ({ createWherebyMeeting: mocks.createMeeting, deleteWherebyMeeting: mocks.deleteMeeting }))
import { POST as patientPost, GET as patientGet } from '@/app/api/patient/[token]/route'
import { POST as invite } from '@/app/api/consultations/[id]/invite/route'
import { POST as video } from '@/app/api/consultations/[id]/video/route'
import { patientInput } from '@/lib/workflow'
const token = 'a'.repeat(64)
const id='11111111-1111-4111-8111-111111111111'
const patientData = { first_name:'Test', last_name:'Patient',date_of_birth:'2000-01-01',contact_info:'test@example.invalid' }
const request = (body: unknown, origin='https://app.example') => new Request('https://app.example/api/test',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=> {
 vi.resetAllMocks(); mocks.cookie=undefined
 mocks.context.mockResolvedValue({staff:{id,practice_id:'practice-a',role:'doctor'},admin:{rpc:mocks.rpc}})
 vi.stubEnv('WHEREBY_API_KEY','test-key')
})
describe('workflow request boundaries',()=>{
 it('rejects cross-origin patient mutations before database access',async()=>{
  expect((await patientPost(request({action:'checkin',data:patientData},'https://evil.example'),{params:{token}})).status).toBe(403)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('rejects missing patient session for status and heartbeat',async()=>{
  expect((await patientGet(new Request('https://app.example'),{params:{token}})).status).toBe(401)
  expect((await patientPost(request({action:'heartbeat'}),{params:{token}})).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('validates real calendar dates and disallows extra patient properties',()=>{
  expect(patientInput.safeParse({...patientData,date_of_birth:'2025-02-30'}).success).toBe(false)
  expect(patientInput.safeParse({...patientData,date_of_birth:'2999-01-01'}).success).toBe(false)
  expect(patientInput.safeParse({...patientData,consultation_id:id}).success).toBe(false)
 })
 it('stores the secret only in an HttpOnly cookie, hashes both credentials and disables caching',async()=>{
  mocks.rpc.mockResolvedValue({data:{expires_at:'2099-01-01T00:00:00Z'},error:null})
  const response=await patientPost(request({action:'checkin',data:patientData}),{params:{token}})
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  expect(response.headers.get('cache-control')).toBe('no-store')
  const args=mocks.rpc.mock.calls[0][1]
  expect(args.p_token_hash).not.toBe(token)
  expect(args.p_session_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(await response.json()).toEqual({expires_at:'2099-01-01T00:00:00Z'})
 })
 it('does not set a session cookie when checkin fails',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:'42501'}})
  const response=await patientPost(request({action:'checkin',data:patientData}),{params:{token}})
  expect(response.status).toBe(403)
  expect(response.headers.get('set-cookie')).toBeNull()
 })
 it('requires authentication before issuing an invitation',async()=>{
  mocks.context.mockResolvedValue({staff:null,status:401})
  expect((await invite(request({}),{params:{id}})).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('uses the verified staff identity and stores only the invitation hash',async()=>{
  mocks.rpc.mockResolvedValue({data:{id},error:null})
  const response=await invite(request({p_staff:'attacker'}),{params:{id}})
  const body=await response.json()
  expect(mocks.rpc.mock.calls[0][1].p_staff).toBe(id)
  expect(mocks.rpc.mock.calls[0][1].p_data.token_hash).not.toBe(body.token)
  expect(body.token).toMatch(/^[a-f0-9]{64}$/)
 })
 it('does not contact Whereby after a denied claim',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:'42501'}})
  expect((await video(request({action:'start'}),{params:{id}})).status).toBe(403)
  expect(mocks.createMeeting).not.toHaveBeenCalled()
 })
 it('cleans up the external room when finalizing a stale claim fails',async()=>{
  mocks.rpc.mockImplementation(async (_name,p)=>p.p_action==='claim'?{data:{claimed:true},error:null}:p.p_action==='start'?{error:{message:'stale_claim'}}:{data:{},error:null})
  mocks.createMeeting.mockResolvedValue({meetingId:'one',roomUrl:'https://test.whereby.com/guest',hostRoomUrl:'https://test.whereby.com/host'})
  const response=await video(request({action:'start'}),{params:{id}})
  expect(response.status).toBe(409)
  expect(mocks.deleteMeeting).toHaveBeenCalledWith('one')
  expect(mocks.rpc.mock.calls.at(-1)?.[1].p_action).toBe('release')
 })
 it('does not complete a consultation if deleting the external room fails',async()=>{
  mocks.rpc.mockResolvedValue({data:{status:'in_progress',meetingId:'one'},error:null})
  mocks.deleteMeeting.mockRejectedValue(new Error('provider unavailable'))
  expect((await video(request({action:'end'}),{params:{id}})).status).toBe(502)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
 })
 it('reports missing Whereby config and releases the claim',async()=>{
  vi.stubEnv('WHEREBY_API_KEY','')
  mocks.rpc.mockResolvedValue({data:{claimed:true},error:null})
  expect((await video(request({action:'start'}),{params:{id}})).status).toBe(503)
  expect(mocks.createMeeting).not.toHaveBeenCalled()
  expect(mocks.rpc.mock.calls.at(-1)?.[1].p_action).toBe('release')
 })
})
