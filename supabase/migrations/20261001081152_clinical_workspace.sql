BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.consultation_summaries ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE INDEX consultations_practice_schedule_idx ON public.consultations(practice_id,scheduled_for DESC);
CREATE INDEX uploaded_documents_consultation_idx ON public.uploaded_documents(consultation_id);
CREATE INDEX document_requests_consultation_idx ON public.document_upload_requests(consultation_id);
-- Private bucket: no browser grants/policies. All reads and writes pass through authorized server routes.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('consultation-documents','consultation-documents',false,3145728,ARRAY['application/pdf','image/jpeg','image/png'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('consultation-exports','consultation-exports',false,41943040,ARRAY['application/zip']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE OR REPLACE FUNCTION public.tm_staff_action(p_staff uuid, p_id uuid, p_action text, p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE s public.staff; c public.consultations; m public.whereby_meetings; claim public.video_room_claims;
 v_id uuid; expiry timestamptz := now() + interval '24 hours';
BEGIN
 SELECT * INTO s FROM public.staff WHERE id = p_staff;
 IF NOT FOUND OR s.role NOT IN ('doctor','admin','nurse') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_action = 'create' THEN
  INSERT INTO public.consultations(practice_id,doctor_id,scheduled_for,consultation_type,patient_first_name,patient_last_name,identity_verification_method,note_to_patient,created_by)
  VALUES(s.practice_id,CASE WHEN s.role='doctor' THEN s.id ELSE NULL END,coalesce((p_data->>'scheduled_for')::timestamptz,now()),p_data->>'consultation_type',p_data->>'patient_first_name',p_data->>'patient_last_name',p_data->>'identity_verification_method',p_data->>'note_to_patient',s.id) RETURNING id INTO v_id;
 ELSE v_id := p_id;
 END IF;
 SELECT * INTO c FROM public.consultations WHERE id=v_id AND practice_id=s.practice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
 expiry := greatest(now(),c.scheduled_for) + interval '24 hours';
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
  IF c.status NOT IN ('scheduled','waiting','in_progress','completed','cancelled') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  RETURN jsonb_build_object('status',c.status,'hostRoomUrl',CASE WHEN c.status='in_progress' AND m.expiry>now() THEN m.host_room_url ELSE NULL END,
   'meetingId',(SELECT provider_room_id FROM public.video_sessions WHERE consultation_id=c.id));
 ELSIF p_action='end' THEN
  IF c.status='completed' THEN RETURN '{}'::jsonb; END IF;
  IF c.status<>'in_progress' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.consultations SET status='completed' WHERE id=c.id;
  UPDATE public.video_sessions SET ended_at=now(),ended_by=s.id WHERE consultation_id=c.id;
  UPDATE public.waiting_room_sessions SET status='left',updated_at=now() WHERE consultation_id=c.id;
  UPDATE public.consultation_tokens SET is_used=true WHERE consultation_id=c.id;
  UPDATE public.document_upload_requests SET is_active=false,revoked_at=now() WHERE consultation_id=c.id AND is_active;
  DELETE FROM public.video_room_claims WHERE consultation_id=c.id;
  -- Keep session valid only to display the completed state. No further patient mutation is allowed.
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
 INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action) VALUES(s.practice_id,c.id,s.id,s.role,'video_'||p_action);
 RETURN '{}'::jsonb;
END $$;


CREATE FUNCTION public.tm_record_action(p_staff uuid,p_id uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.staff; c public.consultations; r public.consultation_summaries; grant_id uuid; expiry timestamptz; v integer;
BEGIN
 SELECT * INTO s FROM public.staff WHERE id=p_staff;
 IF NOT FOUND OR s.role NOT IN ('doctor','admin','nurse') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.consultations WHERE id=p_id AND practice_id=s.practice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.consultation_summaries WHERE consultation_id=c.id;
 IF p_action='read' THEN
  RETURN jsonb_build_object('consultation',to_jsonb(c),'patient',(SELECT to_jsonb(p) FROM public.patients p WHERE consultation_id=c.id),
    'summary',r.summary_text,'revision',coalesce(r.revision,0),'updated_at',r.updated_at,'can_edit',s.role IN ('doctor','admin'),
    'documents',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.uploaded_at) FROM public.uploaded_documents d WHERE consultation_id=c.id),'[]'::jsonb),
    'upload_enabled',c.status IN ('scheduled','waiting','in_progress') AND EXISTS(SELECT 1 FROM public.document_upload_requests WHERE consultation_id=c.id AND is_active AND expires_at>now()),
    'video',(SELECT jsonb_build_object('started_at',started_at,'ended_at',ended_at) FROM public.video_sessions WHERE consultation_id=c.id));
 ELSIF p_action='save' THEN
  IF s.role NOT IN ('doctor','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF (p_data->>'revision')::integer IS DISTINCT FROM coalesce(r.revision,0) THEN RAISE EXCEPTION 'record_conflict'; END IF;
  IF p_data->>'summary' IS NULL OR length(p_data->>'summary')>50000 THEN RAISE EXCEPTION 'invalid_record'; END IF;
  v:=coalesce(r.revision,0)+1;
  INSERT INTO public.consultation_summaries(consultation_id,doctor_id,summary_text,revision)
   VALUES(c.id,s.id,p_data->>'summary',v)
   ON CONFLICT(consultation_id) DO UPDATE SET summary_text=excluded.summary_text,doctor_id=excluded.doctor_id,revision=excluded.revision,updated_at=now();
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action,metadata) VALUES(s.practice_id,c.id,s.id,s.role,'clinical_record_saved',jsonb_build_object('revision',v));
  RETURN jsonb_build_object('revision',v,'updated_at',now());
 ELSIF p_action IN ('request','revoke') THEN
  IF c.status NOT IN ('scheduled','waiting','in_progress') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.document_upload_requests SET is_active=false,revoked_at=now() WHERE consultation_id=c.id AND is_active;
  IF p_action='request' THEN
   expiry:=greatest(now(),c.scheduled_for)+interval '24 hours';
   INSERT INTO public.document_upload_requests(consultation_id,requested_by,expires_at) VALUES(c.id,s.id,expiry) RETURNING id INTO grant_id;
  END IF;
 ELSIF p_action='reschedule' THEN
  IF c.status NOT IN ('scheduled','waiting') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  expiry:=(p_data->>'scheduled_for')::timestamptz;
  IF expiry IS NULL OR expiry<now()-interval '1 minute' OR expiry>now()+interval '366 days' THEN RAISE EXCEPTION 'invalid_date'; END IF;
  UPDATE public.consultations SET scheduled_for=expiry WHERE id=c.id;
  UPDATE public.consultation_tokens SET expires_at=expiry+interval '24 hours' WHERE consultation_id=c.id AND expires_at>now();
  UPDATE public.patient_sessions SET expires_at=expiry+interval '24 hours' WHERE consultation_id=c.id AND expires_at>now() AND revoked_at IS NULL;
  UPDATE public.document_upload_requests SET expires_at=expiry+interval '24 hours' WHERE consultation_id=c.id AND expires_at>now() AND is_active;
 ELSIF p_action='cancel' THEN
  IF c.status='cancelled' THEN RETURN '{}'::jsonb; END IF;
  IF c.status NOT IN ('scheduled','waiting') THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.consultations SET status='cancelled' WHERE id=c.id;
  UPDATE public.waiting_room_sessions SET status='removed',updated_at=now() WHERE consultation_id=c.id;
  UPDATE public.consultation_tokens SET is_used=true WHERE consultation_id=c.id;
  UPDATE public.document_upload_requests SET is_active=false,revoked_at=now() WHERE consultation_id=c.id AND is_active;
  DELETE FROM public.video_room_claims WHERE consultation_id=c.id;
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
 INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action) VALUES(s.practice_id,c.id,s.id,s.role,'consultation_'||p_action);
 RETURN '{}'::jsonb;
END $$;

CREATE FUNCTION public.tm_patient_documents(p_token_hash text,p_session_hash text,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.consultations; sess public.patient_sessions; g public.document_upload_requests; pid uuid; doc_id uuid;
BEGIN
 SELECT c1.* INTO c FROM public.consultations c1 JOIN public.consultation_tokens t ON t.consultation_id=c1.id WHERE t.token_hash=p_token_hash FOR UPDATE OF c1;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_session' USING ERRCODE='42501'; END IF;
 SELECT * INTO sess FROM public.patient_sessions WHERE consultation_id=c.id AND invitation_hash=p_token_hash AND session_hash=p_session_hash AND revoked_at IS NULL AND expires_at>now();
 IF NOT FOUND OR sess.instructions_at IS NULL THEN RAISE EXCEPTION 'invalid_session' USING ERRCODE='42501'; END IF;
 SELECT * INTO g FROM public.document_upload_requests WHERE consultation_id=c.id AND is_active AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
 IF p_action='status' THEN
  RETURN jsonb_build_object('enabled',g.id IS NOT NULL AND c.status IN ('waiting','in_progress'),
    'documents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'file_name',file_name,'file_size',file_size) ORDER BY uploaded_at) FROM public.uploaded_documents WHERE consultation_id=c.id),'[]'::jsonb));
 END IF;
 IF c.status NOT IN ('waiting','in_progress') OR g.id IS NULL THEN RAISE EXCEPTION 'upload_disabled'; END IF;
 IF (SELECT count(*) FROM public.uploaded_documents WHERE consultation_id=c.id)>=10 THEN RAISE EXCEPTION 'upload_limit'; END IF;
 SELECT id INTO pid FROM public.patients WHERE consultation_id=c.id;
 IF p_action='check' THEN RETURN jsonb_build_object('consultation_id',c.id,'request_id',g.id); END IF;
 IF p_action<>'commit' OR (p_data->>'request_id')::uuid IS DISTINCT FROM g.id THEN RAISE EXCEPTION 'upload_disabled'; END IF;
 IF p_data->>'file_type' NOT IN ('application/pdf','image/jpeg','image/png') OR (p_data->>'file_size')::integer NOT BETWEEN 1 AND 3145728
   OR length(p_data->>'file_name') NOT BETWEEN 1 AND 180 OR p_data->>'storage_path' !~ ('^'||c.id::text||'/[a-f0-9-]{36}$') THEN RAISE EXCEPTION 'invalid_file'; END IF;
 INSERT INTO public.uploaded_documents(consultation_id,patient_id,upload_request_id,file_name,file_type,file_size,storage_path,context)
 VALUES(c.id,pid,g.id,p_data->>'file_name',p_data->>'file_type',(p_data->>'file_size')::integer,p_data->>'storage_path',CASE WHEN c.status='waiting' THEN 'waiting_room' ELSE 'video_room' END) RETURNING id INTO doc_id;
 INSERT INTO public.audit_logs(practice_id,consultation_id,actor_role,action) VALUES(c.practice_id,c.id,'patient','document_uploaded');
 RETURN jsonb_build_object('id',doc_id);
END $$;
REVOKE ALL ON FUNCTION public.tm_record_action(uuid,uuid,text,jsonb),public.tm_patient_documents(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_record_action(uuid,uuid,text,jsonb),public.tm_patient_documents(text,text,text,jsonb) TO service_role;
COMMIT;
