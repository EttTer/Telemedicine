-- App-level evidence and immutable snapshots; not a substitute for AIS authorization.
CREATE TABLE public.practice_compliance (
 practice_id uuid PRIMARY KEY REFERENCES public.practices(id),
 legal_name text NOT NULL DEFAULT '', ico text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
 privacy_contact text NOT NULL DEFAULT '', retention_notice text NOT NULL DEFAULT '',
 legal_basis_notice text NOT NULL DEFAULT '', vendor_notice text NOT NULL DEFAULT '',
 practitioner_identity_method text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.consultation_acknowledgements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consultation_id uuid NOT NULL REFERENCES public.consultations(id),
 session_id uuid NOT NULL REFERENCES public.patient_sessions(id), version text NOT NULL,
 care_consent boolean NOT NULL CHECK(care_consent), recording_preference text NOT NULL CHECK(recording_preference IN ('declined','not_requested')),
 instruction_snapshot jsonb NOT NULL, acknowledged_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,version)
);
CREATE TABLE public.clinical_record_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consultation_id uuid NOT NULL REFERENCES public.consultations(id),
 revision integer NOT NULL, summary_text text NOT NULL, author_id uuid REFERENCES public.staff(id),
 saved_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL DEFAULT 'edit', amendment_reason text NOT NULL DEFAULT '',
 UNIQUE(consultation_id,revision)
);
CREATE TABLE public.clinical_record_finalizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consultation_id uuid NOT NULL REFERENCES public.consultations(id),
 revision integer NOT NULL, finalized_by uuid NOT NULL REFERENCES public.staff(id), finalized_at timestamptz NOT NULL DEFAULT now(),
 snapshot jsonb NOT NULL, UNIQUE(consultation_id,revision)
);
ALTER TABLE public.consultation_summaries ADD COLUMN amendment_reason text NOT NULL DEFAULT '';
CREATE INDEX acknowledgements_consultation_idx ON public.consultation_acknowledgements(consultation_id,acknowledged_at DESC);
CREATE INDEX finalizations_consultation_idx ON public.clinical_record_finalizations(consultation_id,revision DESC);
CREATE INDEX audit_logs_consultation_time_idx ON public.audit_logs(consultation_id,created_at DESC);
ALTER TABLE public.practice_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_record_finalizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_compliance,public.consultation_acknowledgements,public.clinical_record_versions,public.clinical_record_finalizations FROM anon,authenticated;
GRANT ALL ON public.practice_compliance,public.consultation_acknowledgements,public.clinical_record_versions,public.clinical_record_finalizations TO service_role;
-- Preserve only the existing current version; no invented historical edits or confirmations.
INSERT INTO public.clinical_record_versions(consultation_id,revision,summary_text,author_id,saved_at,source)
 SELECT consultation_id,revision,coalesce(summary_text,''),doctor_id,coalesce(updated_at,created_at),'baseline' FROM public.consultation_summaries;
CREATE FUNCTION public.tm_immutable_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'immutable_evidence'; END $$;
CREATE TRIGGER immutable_audit_logs BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.tm_immutable_evidence();
CREATE TRIGGER immutable_record_versions BEFORE UPDATE OR DELETE ON public.clinical_record_versions FOR EACH ROW EXECUTE FUNCTION public.tm_immutable_evidence();
CREATE TRIGGER immutable_finalizations BEFORE UPDATE OR DELETE ON public.clinical_record_finalizations FOR EACH ROW EXECUTE FUNCTION public.tm_immutable_evidence();
CREATE TRIGGER immutable_acknowledgements BEFORE UPDATE OR DELETE ON public.consultation_acknowledgements FOR EACH ROW EXECUTE FUNCTION public.tm_immutable_evidence();
REVOKE ALL ON FUNCTION public.tm_immutable_evidence() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_immutable_evidence() TO service_role;
-- MFA must protect Data API access as well as server routes.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('CREATE POLICY staff_mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((select auth.jwt()->>''aal'')=''aal2'') WITH CHECK ((select auth.jwt()->>''aal'')=''aal2'')',t);
 END LOOP;
END $$;

ALTER FUNCTION public.tm_record_action(uuid,uuid,text,jsonb) RENAME TO tm_record_action_base;
REVOKE EXECUTE ON FUNCTION public.tm_record_action_base(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tm_record_action(p_staff uuid,p_id uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.staff; c public.consultations; r public.consultation_summaries; result jsonb; final public.clinical_record_finalizations;
 ident jsonb; provider jsonb; author jsonb; v integer; reason text; snapshot jsonb;
BEGIN
 SELECT * INTO s FROM public.staff WHERE id=p_staff;
 IF NOT FOUND OR s.role NOT IN ('doctor','admin','nurse') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.consultations WHERE id=p_id AND practice_id=s.practice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.consultation_summaries WHERE consultation_id=c.id;
 SELECT * INTO final FROM public.clinical_record_finalizations WHERE consultation_id=c.id ORDER BY revision DESC LIMIT 1;
 SELECT to_jsonb(i)||jsonb_build_object('verified_by_name',(SELECT concat_ws(' ',first_name,last_name) FROM public.staff WHERE id=i.verified_by)) INTO ident FROM public.identity_verifications i WHERE consultation_id=c.id;
 SELECT jsonb_build_object('name',p.name,'contact_email',p.contact_email,'contact_phone',p.contact_phone)||coalesce(to_jsonb(pc),'{}') INTO provider FROM public.practices p LEFT JOIN public.practice_compliance pc ON pc.practice_id=p.id WHERE p.id=c.practice_id;
 SELECT jsonb_build_object('id',a.id,'name',concat_ws(' ',a.title_before,a.first_name,a.last_name,a.title_after)) INTO author FROM public.staff a WHERE id=coalesce(r.doctor_id,c.doctor_id,c.created_by);
 IF p_action='read' THEN
  result:=public.tm_record_action_base(p_staff,p_id,'read','{}');
  IF final.id IS NOT NULL AND final.revision=r.revision THEN
   result:=result||final.snapshot;
   ident:=final.snapshot->'identity'; provider:=final.snapshot->'provider'; author:=final.snapshot->'author';
  END IF;
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action) VALUES(s.practice_id,c.id,s.id,s.role,'record_read');
  RETURN result||jsonb_build_object('identity',ident,'provider',provider,'author',author,'edit_role',s.role IN ('doctor','admin'),
   'can_edit',s.role IN ('doctor','admin') AND (final.id IS NULL OR final.revision IS DISTINCT FROM r.revision),
   'finalization',CASE WHEN final.id IS NOT NULL AND final.revision=r.revision THEN jsonb_build_object('id',final.id,'revision',final.revision,'finalized_at',final.finalized_at,'by_name',(SELECT concat_ws(' ',first_name,last_name) FROM public.staff WHERE id=final.finalized_by)) END,
   'acknowledgement',(SELECT jsonb_build_object('version',version,'care_consent',care_consent,'recording_preference',recording_preference,'acknowledged_at',acknowledged_at) FROM public.consultation_acknowledgements WHERE consultation_id=c.id ORDER BY acknowledged_at DESC LIMIT 1),
   'amendment_reason',r.amendment_reason,
   'versions',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY revision DESC) FROM (SELECT revision,saved_at,source,amendment_reason,(SELECT concat_ws(' ',first_name,last_name) FROM public.staff WHERE id=rv.author_id) AS author FROM public.clinical_record_versions rv WHERE consultation_id=c.id ORDER BY revision DESC LIMIT 20)x),'[]'));
 ELSIF p_action='read_version' THEN
  SELECT jsonb_build_object('summary',summary_text,'revision',revision,'saved_at',saved_at,'amendment_reason',amendment_reason) INTO result FROM public.clinical_record_versions WHERE consultation_id=c.id AND revision=(p_data->>'revision')::integer;
  IF result IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action,metadata) VALUES(s.practice_id,c.id,s.id,s.role,'record_version_read',jsonb_build_object('revision',p_data->'revision'));
  RETURN result;
 ELSIF p_action IN ('verify_identity','finalize','reopen','save') THEN
  IF s.role NOT IN ('doctor','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF p_action IN ('finalize','reopen','save') AND (p_data->>'revision')::integer IS DISTINCT FROM coalesce(r.revision,0) THEN RAISE EXCEPTION 'record_conflict'; END IF;
  IF p_action IN ('save','verify_identity') AND final.id IS NOT NULL AND final.revision=r.revision THEN RAISE EXCEPTION 'record_finalized'; END IF;
  IF p_action='verify_identity' THEN
   IF c.status NOT IN ('in_progress','completed') OR length(trim(coalesce(p_data->>'method','')))<5 OR length(p_data->>'method')>200 THEN RAISE EXCEPTION 'invalid_identity'; END IF;
   INSERT INTO public.identity_verifications(consultation_id,method,status,verified_by,verified_at) VALUES(c.id,p_data->>'method',CASE WHEN (p_data->>'verified')::boolean THEN 'verified' ELSE 'rejected' END,s.id,now())
    ON CONFLICT(consultation_id) DO UPDATE SET method=excluded.method,status=excluded.status,verified_by=excluded.verified_by,verified_at=excluded.verified_at;
   UPDATE public.consultations SET identity_verification_method=p_data->>'method' WHERE id=c.id;
  ELSIF p_action='save' THEN
   result:=public.tm_record_action_base(p_staff,p_id,p_action,p_data);
   SELECT * INTO r FROM public.consultation_summaries WHERE consultation_id=c.id;
   INSERT INTO public.clinical_record_versions(consultation_id,revision,summary_text,author_id,amendment_reason) VALUES(c.id,r.revision,r.summary_text,s.id,r.amendment_reason);
   RETURN result;
  ELSIF p_action='reopen' THEN
   reason:=trim(coalesce(p_data->>'reason',''));
   IF final.id IS NULL OR final.revision IS DISTINCT FROM r.revision OR length(reason)<3 OR length(reason)>1000 THEN RAISE EXCEPTION 'invalid_amendment'; END IF;
   v:=r.revision+1;
   UPDATE public.consultation_summaries SET revision=v,amendment_reason=reason,doctor_id=s.id,updated_at=now() WHERE consultation_id=c.id;
   INSERT INTO public.clinical_record_versions(consultation_id,revision,summary_text,author_id,source,amendment_reason) VALUES(c.id,v,r.summary_text,s.id,'amendment',reason);
  ELSE
   IF c.status<>'completed' OR r.id IS NULL OR length(trim(r.summary_text))=0 THEN RAISE EXCEPTION 'record_incomplete'; END IF;
   IF ident->>'status' IS DISTINCT FROM 'verified' THEN RAISE EXCEPTION 'identity_required'; END IF;
   IF length(coalesce(provider->>'legal_name',''))=0 OR length(coalesce(provider->>'ico',''))=0 OR length(coalesce(provider->>'address',''))=0 THEN RAISE EXCEPTION 'provider_incomplete'; END IF;
   IF final.id IS NOT NULL AND final.revision=r.revision THEN RETURN jsonb_build_object('id',final.id); END IF;
   snapshot:=public.tm_record_action_base(p_staff,p_id,'read','{}')||jsonb_build_object('identity',ident,'provider',provider,'author',author,'acknowledgement',(SELECT to_jsonb(a)-'session_id' FROM public.consultation_acknowledgements a WHERE consultation_id=c.id ORDER BY acknowledged_at DESC LIMIT 1));
   INSERT INTO public.clinical_record_finalizations(consultation_id,revision,finalized_by,snapshot) VALUES(c.id,r.revision,s.id,snapshot) RETURNING id INTO final.id;
  END IF;
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action,metadata) VALUES(s.practice_id,c.id,s.id,s.role,'record_'||p_action,jsonb_strip_nulls(jsonb_build_object('revision',coalesce(v,r.revision),'identity_verified',p_data->'verified','method',p_data->'method')));
  RETURN jsonb_build_object('revision',coalesce(v,r.revision));
 ELSE RETURN public.tm_record_action_base(p_staff,p_id,p_action,p_data); END IF;
END $$;
REVOKE ALL ON FUNCTION public.tm_record_action(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_record_action(uuid,uuid,text,jsonb) TO service_role;

ALTER FUNCTION public.tm_patient_action(text,text,text,jsonb) RENAME TO tm_patient_action_base;
REVOKE ALL ON FUNCTION public.tm_patient_action_base(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tm_patient_action(p_token_hash text,p_session_hash text,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; sess public.patient_sessions; choice text;
BEGIN
 IF p_action='join' THEN
  choice:=p_data->>'recording_preference';
  IF p_data->>'care_consent' IS DISTINCT FROM 'true' OR choice IS NULL OR choice NOT IN ('declined','not_requested') OR p_data->>'instruction_version' IS DISTINCT FROM '2026-10-01-v2' OR jsonb_typeof(p_data->'instruction_snapshot') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'instructions_required'; END IF;
 END IF;
 result:=public.tm_patient_action_base(p_token_hash,p_session_hash,p_action,p_data);
 IF p_action='join' THEN
  SELECT * INTO sess FROM public.patient_sessions WHERE session_hash=p_session_hash AND invitation_hash=p_token_hash;
  INSERT INTO public.consultation_acknowledgements(consultation_id,session_id,version,care_consent,recording_preference,instruction_snapshot) VALUES(sess.consultation_id,sess.id,p_data->>'instruction_version',true,choice,p_data->'instruction_snapshot') ON CONFLICT(session_id,version) DO NOTHING;
  IF FOUND THEN
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_role,action,metadata) SELECT practice_id,id,'patient','patient_care_acknowledged',jsonb_build_object('version','2026-10-01-v2','recording_preference',choice) FROM public.consultations WHERE id=sess.consultation_id;
  END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.tm_patient_action(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_patient_action(text,text,text,jsonb) TO service_role;
CREATE FUNCTION public.tm_practice_action(p_staff uuid,p_data jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.staff; r public.practice_compliance; editable boolean;
BEGIN
 SELECT * INTO s FROM public.staff WHERE id=p_staff;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 editable:=s.role='admin' OR (s.role='doctor' AND NOT EXISTS(SELECT 1 FROM public.staff WHERE practice_id=s.practice_id AND role='admin'));
 IF p_data IS NOT NULL THEN
  IF NOT editable THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF length(p_data::text)>20000 THEN RAISE EXCEPTION 'invalid_profile'; END IF;
  INSERT INTO public.practice_compliance(practice_id,legal_name,ico,address,privacy_contact,retention_notice,legal_basis_notice,vendor_notice,practitioner_identity_method)
   VALUES(s.practice_id,coalesce(p_data->>'legal_name',''),coalesce(p_data->>'ico',''),coalesce(p_data->>'address',''),coalesce(p_data->>'privacy_contact',''),coalesce(p_data->>'retention_notice',''),coalesce(p_data->>'legal_basis_notice',''),coalesce(p_data->>'vendor_notice',''),coalesce(p_data->>'practitioner_identity_method',''))
   ON CONFLICT(practice_id) DO UPDATE SET legal_name=excluded.legal_name,ico=excluded.ico,address=excluded.address,privacy_contact=excluded.privacy_contact,retention_notice=excluded.retention_notice,legal_basis_notice=excluded.legal_basis_notice,vendor_notice=excluded.vendor_notice,practitioner_identity_method=excluded.practitioner_identity_method,updated_at=now();
  INSERT INTO public.audit_logs(practice_id,actor_id,actor_role,action) VALUES(s.practice_id,s.id,s.role,'practice_profile_updated');
 END IF;
 SELECT * INTO r FROM public.practice_compliance WHERE practice_id=s.practice_id;
 RETURN jsonb_build_object('profile',coalesce(to_jsonb(r),'{}'),'can_edit',editable);
END $$;
REVOKE ALL ON FUNCTION public.tm_practice_action(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_practice_action(uuid,jsonb) TO service_role;
