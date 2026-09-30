BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.patient_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
 invitation_hash text NOT NULL,
 session_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 instructions_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_sessions_consultation_idx ON public.patient_sessions(consultation_id);
CREATE TABLE public.video_room_claims (
 consultation_id uuid PRIMARY KEY REFERENCES public.consultations(id) ON DELETE CASCADE,
 claim_id uuid NOT NULL, expires_at timestamptz NOT NULL
);
ALTER TABLE public.patient_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_room_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_sessions, public.video_room_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.patient_sessions, public.video_room_claims TO service_role;

-- Invoker functions: callable only by the server service role, never by browser roles.
-- All transitions lock the consultation first, so rotation, check-in and admission serialize.
CREATE FUNCTION public.tm_staff_action(p_staff uuid, p_id uuid, p_action text, p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE s public.staff; c public.consultations; m public.whereby_meetings; claim public.video_room_claims;
 v_id uuid; expiry timestamptz := now() + interval '24 hours';
BEGIN
 SELECT * INTO s FROM public.staff WHERE id = p_staff;
 IF NOT FOUND OR s.role NOT IN ('doctor','admin','nurse') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_action = 'create' THEN
  INSERT INTO public.consultations(practice_id,doctor_id,scheduled_for,consultation_type,patient_first_name,patient_last_name,identity_verification_method,note_to_patient,created_by)
  VALUES(s.practice_id,CASE WHEN s.role='doctor' THEN s.id ELSE NULL END,now(),p_data->>'consultation_type',p_data->>'patient_first_name',p_data->>'patient_last_name',p_data->>'identity_verification_method',p_data->>'note_to_patient',s.id) RETURNING id INTO v_id;
 ELSE v_id := p_id;
 END IF;
 SELECT * INTO c FROM public.consultations WHERE id=v_id AND practice_id=s.practice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
 IF p_action IN ('create','invite') THEN
  IF c.status NOT IN ('scheduled','waiting') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  IF coalesce(p_data->>'token_hash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_token'; END IF;
  UPDATE public.consultation_tokens SET is_used=true WHERE consultation_id=c.id AND NOT is_used;
  UPDATE public.patient_sessions SET revoked_at=now() WHERE consultation_id=c.id AND revoked_at IS NULL;
  INSERT INTO public.consultation_tokens(consultation_id,token_hash,expires_at) VALUES(c.id,p_data->>'token_hash',expiry);
  UPDATE public.waiting_room_sessions SET status='removed',updated_at=now() WHERE consultation_id=c.id;
  UPDATE public.consultations SET status='scheduled' WHERE id=c.id;
  DELETE FROM public.video_room_claims WHERE consultation_id=c.id;
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action) VALUES(s.practice_id,c.id,s.id,s.role,CASE WHEN p_action='create' THEN 'consultation_created' ELSE 'invitation_reissued' END);
  RETURN jsonb_build_object('id',c.id,'expires_at',expiry);
 END IF;
 IF s.role NOT IN ('doctor','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.whereby_meetings WHERE consultation_id=c.id;
 IF p_action='claim' THEN
  IF c.status='in_progress' AND m.id IS NOT NULL AND m.expiry>now() THEN
   RETURN jsonb_build_object('hostRoomUrl',m.host_room_url);
  END IF;
  IF c.status<>'waiting' OR NOT EXISTS(SELECT 1 FROM public.patient_sessions WHERE consultation_id=c.id AND revoked_at IS NULL AND expires_at>now() AND instructions_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.waiting_room_sessions WHERE consultation_id=c.id AND status='waiting' AND updated_at>now()-interval '60 seconds') THEN RAISE EXCEPTION 'patient_not_waiting'; END IF;
  SELECT * INTO claim FROM public.video_room_claims WHERE consultation_id=c.id;
  IF FOUND AND claim.expires_at>now() THEN RAISE EXCEPTION 'room_busy'; END IF;
  INSERT INTO public.video_room_claims VALUES(c.id,(p_data->>'claim_id')::uuid,now()+interval '60 seconds')
   ON CONFLICT(consultation_id) DO UPDATE SET claim_id=excluded.claim_id,expires_at=excluded.expires_at;
  RETURN jsonb_build_object('claimed',true);
 ELSIF p_action='release' THEN
  DELETE FROM public.video_room_claims WHERE consultation_id=c.id AND claim_id=(p_data->>'claim_id')::uuid;
  RETURN '{}'::jsonb;
 ELSIF p_action='start' THEN
  IF c.status<>'waiting' OR NOT EXISTS(SELECT 1 FROM public.video_room_claims WHERE consultation_id=c.id AND claim_id=(p_data->>'claim_id')::uuid AND expires_at>now()) THEN RAISE EXCEPTION 'stale_claim'; END IF;
  INSERT INTO public.whereby_meetings(consultation_id,room_url,host_room_url,expiry)
   VALUES(c.id,p_data->>'roomUrl',p_data->>'hostRoomUrl',(p_data->>'expiry')::timestamptz)
   ON CONFLICT(consultation_id) DO UPDATE SET room_url=excluded.room_url,host_room_url=excluded.host_room_url,expiry=excluded.expiry;
  INSERT INTO public.video_sessions(consultation_id,provider_room_id,provider_room_url,started_at)
   VALUES(c.id,p_data->>'meetingId',p_data->>'roomUrl',now())
   ON CONFLICT(consultation_id) DO UPDATE SET provider_room_id=excluded.provider_room_id,provider_room_url=excluded.provider_room_url,started_at=excluded.started_at,ended_at=NULL,ended_by=NULL;
  UPDATE public.consultations SET status='in_progress',doctor_id=s.id WHERE id=c.id;
  UPDATE public.waiting_room_sessions SET status='admitted',updated_at=now() WHERE consultation_id=c.id;
  DELETE FROM public.video_room_claims WHERE consultation_id=c.id;
 ELSIF p_action='room' THEN
  IF c.status NOT IN ('in_progress','completed') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  RETURN jsonb_build_object('status',c.status,'hostRoomUrl',CASE WHEN c.status='in_progress' AND m.expiry>now() THEN m.host_room_url ELSE NULL END,
   'meetingId',(SELECT provider_room_id FROM public.video_sessions WHERE consultation_id=c.id));
 ELSIF p_action='end' THEN
  IF c.status='completed' THEN RETURN '{}'::jsonb; END IF;
  IF c.status<>'in_progress' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.consultations SET status='completed' WHERE id=c.id;
  UPDATE public.video_sessions SET ended_at=now(),ended_by=s.id WHERE consultation_id=c.id;
  UPDATE public.waiting_room_sessions SET status='left',updated_at=now() WHERE consultation_id=c.id;
  UPDATE public.consultation_tokens SET is_used=true WHERE consultation_id=c.id;
  -- Keep session valid only to display the completed state. No further patient mutation is allowed.
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
 INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action) VALUES(s.practice_id,c.id,s.id,s.role,'video_'||p_action);
 RETURN '{}'::jsonb;
END $$;

CREATE FUNCTION public.tm_patient_action(p_token_hash text,p_session_hash text,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE t public.consultation_tokens; c public.consultations; sess public.patient_sessions; pid uuid; room text;
BEGIN
 SELECT * INTO t FROM public.consultation_tokens WHERE token_hash=p_token_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_invitation' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.consultations WHERE id=t.consultation_id FOR UPDATE;
 SELECT * INTO t FROM public.consultation_tokens WHERE token_hash=p_token_hash;
 SELECT * INTO sess FROM public.patient_sessions WHERE invitation_hash=p_token_hash AND session_hash=p_session_hash AND revoked_at IS NULL AND expires_at>now();
 IF p_action='checkin' THEN
  IF c.status NOT IN ('scheduled','waiting') OR (sess.id IS NULL AND (t.is_used OR t.expires_at<=now())) THEN RAISE EXCEPTION 'invalid_invitation' USING ERRCODE='42501'; END IF;
  IF coalesce(p_session_hash,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_session'; END IF;
  INSERT INTO public.patients(consultation_id,first_name,last_name,date_of_birth,contact_info,reason_for_visit)
   VALUES(c.id,p_data->>'first_name',p_data->>'last_name',(p_data->>'date_of_birth')::date,p_data->>'contact_info',p_data->>'reason_for_visit')
   ON CONFLICT(consultation_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,date_of_birth=excluded.date_of_birth,contact_info=excluded.contact_info,reason_for_visit=excluded.reason_for_visit
   RETURNING id INTO pid;
  UPDATE public.consultations SET patient_first_name=p_data->>'first_name',patient_last_name=p_data->>'last_name' WHERE id=c.id;
  IF sess.id IS NULL THEN
   INSERT INTO public.patient_sessions(consultation_id,invitation_hash,session_hash,expires_at) VALUES(c.id,p_token_hash,p_session_hash,t.expires_at);
   UPDATE public.consultation_tokens SET is_used=true WHERE id=t.id;
  END IF;
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_role,action) VALUES(c.practice_id,c.id,'patient','patient_checkin');
  RETURN jsonb_build_object('expires_at',t.expires_at);
 END IF;
 IF sess.id IS NULL THEN RAISE EXCEPTION 'invalid_session' USING ERRCODE='42501'; END IF;
 IF c.status IN ('completed','cancelled') THEN RETURN jsonb_build_object('status',c.status); END IF;
 IF p_action='join' THEN
  IF p_data->>'acknowledged' IS DISTINCT FROM 'true' OR c.status NOT IN ('scheduled','waiting') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  SELECT id INTO pid FROM public.patients WHERE consultation_id=c.id;
  IF pid IS NULL THEN RAISE EXCEPTION 'checkin_required'; END IF;
  UPDATE public.patient_sessions SET instructions_at=coalesce(instructions_at,now()) WHERE id=sess.id;
  INSERT INTO public.waiting_room_sessions(consultation_id,patient_id,status) VALUES(c.id,pid,'waiting')
   ON CONFLICT(consultation_id) DO UPDATE SET status='waiting',patient_id=excluded.patient_id,updated_at=now();
  UPDATE public.consultations SET status='waiting' WHERE id=c.id;
  IF sess.instructions_at IS NULL THEN
   INSERT INTO public.audit_logs(practice_id,consultation_id,actor_role,action,metadata) VALUES(c.practice_id,c.id,'patient','instructions_acknowledged','{"version":"2026-09-30","recording_requested":false}');
  END IF;
  RETURN jsonb_build_object('status','waiting');
 ELSIF p_action IN ('status','heartbeat') THEN
  IF p_action='heartbeat' AND sess.instructions_at IS NOT NULL THEN
   UPDATE public.waiting_room_sessions SET updated_at=now() WHERE consultation_id=c.id AND status IN ('waiting','admitted');
  END IF;
  IF c.status='in_progress' AND sess.instructions_at IS NOT NULL THEN
   SELECT room_url INTO room FROM public.whereby_meetings WHERE consultation_id=c.id AND expiry>now();
  END IF;
  RETURN jsonb_build_object('status',c.status,'acknowledged',sess.instructions_at IS NOT NULL,'note',c.note_to_patient,'roomUrl',room);
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.tm_staff_action(uuid,uuid,text,jsonb), public.tm_patient_action(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_staff_action(uuid,uuid,text,jsonb), public.tm_patient_action(text,text,text,jsonb) TO service_role;
COMMIT;
