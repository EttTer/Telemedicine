import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({session:vi.fn(),admin:vi.fn(),user:vi.fn(),aal:vi.fn(),profile:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:m.session,createAdminClient:m.admin}));
import {getStaffContext} from '@/lib/staff';
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({data:{user:{id:'verified-user'}},error:null});m.aal.mockResolvedValue({data:{currentLevel:'aal2'},error:null});m.profile.mockResolvedValue({data:{id:'verified-user',practice_id:'A',role:'doctor'},error:null});const q:any={select:()=>q,eq:m.eq,single:m.profile};m.eq.mockReturnValue(q);m.admin.mockReturnValue({from:()=>q});m.session.mockResolvedValue({auth:{getUser:m.user,mfa:{getAuthenticatorAssuranceLevel:m.aal}}});});
describe('staff password authentication',()=>{
 it('does not access privileged data after failed authentication',async()=>{m.user.mockResolvedValue({data:{user:null},error:null});expect((await getStaffContext()).status).toBe(401);expect(m.admin).not.toHaveBeenCalled();});
 it('allows a verified password session without querying a second factor',async()=>{m.aal.mockResolvedValue({data:{currentLevel:'aal1'},error:null});expect((await getStaffContext()).status).toBe(200);expect(m.aal).not.toHaveBeenCalled();});
 it('rejects an invalid session even if a user payload is present',async()=>{m.user.mockResolvedValue({data:{user:{id:'verified-user'}},error:{message:'expired'}});expect((await getStaffContext()).status).toBe(401);expect(m.admin).not.toHaveBeenCalled();});
 it('fetches only the verified caller profile after password authentication',async()=>{expect((await getStaffContext()).status).toBe(200);expect(m.eq).toHaveBeenCalledWith('id','verified-user');});
 it('still requires a staff role',async()=>{m.profile.mockResolvedValue({data:{practice_id:'A',role:'patient'},error:null});expect((await getStaffContext()).status).toBe(403);expect(m.aal).not.toHaveBeenCalled();});
});
