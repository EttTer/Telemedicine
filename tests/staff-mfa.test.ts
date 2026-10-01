import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({session:vi.fn(),admin:vi.fn(),user:vi.fn(),aal:vi.fn(),profile:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:m.session,createAdminClient:m.admin}));
import {getStaffContext} from '@/lib/staff';
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({data:{user:{id:'verified-user'}},error:null});m.aal.mockResolvedValue({data:{currentLevel:'aal2'},error:null});m.profile.mockResolvedValue({data:{id:'verified-user',practice_id:'A',role:'doctor'},error:null});const q:any={select:()=>q,eq:m.eq,single:m.profile};m.eq.mockReturnValue(q);m.admin.mockReturnValue({from:()=>q});m.session.mockResolvedValue({auth:{getUser:m.user,mfa:{getAuthenticatorAssuranceLevel:m.aal}}});});
describe('staff MFA gate',()=>{
 it('does not access privileged data after failed authentication',async()=>{m.user.mockResolvedValue({data:{user:null},error:null});expect((await getStaffContext()).status).toBe(401);expect(m.admin).not.toHaveBeenCalled();});
 it.each(['aal1',null])('does not access privileged data with assurance %s',async currentLevel=>{m.aal.mockResolvedValue({data:{currentLevel},error:null});expect((await getStaffContext()).status).toBe(428);expect(m.admin).not.toHaveBeenCalled();});
 it('fails closed if assurance check errors',async()=>{m.aal.mockResolvedValue({data:null,error:{message:'unavailable'}});expect((await getStaffContext()).status).toBe(428);expect(m.admin).not.toHaveBeenCalled();});
 it('fetches only the verified caller profile after MFA',async()=>{expect((await getStaffContext()).status).toBe(200);expect(m.eq).toHaveBeenCalledWith('id','verified-user');});
 it('allows authenticated setup but still requires a staff role',async()=>{m.profile.mockResolvedValue({data:{practice_id:'A',role:'patient'},error:null});expect((await getStaffContext({allowMfaSetup:true})).status).toBe(403);expect(m.aal).not.toHaveBeenCalled();});
});
