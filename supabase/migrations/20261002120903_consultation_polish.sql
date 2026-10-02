-- Optional human-readable descriptions; original filenames and objects are retained.
ALTER TABLE public.uploaded_documents ADD COLUMN label text NOT NULL DEFAULT ''
  CHECK (length(label) <= 200);

-- Preserve all existing clinical revision/finalization checks in the delegated function.
ALTER FUNCTION public.tm_record_action(uuid,uuid,text,jsonb) RENAME TO tm_record_action_versions;
REVOKE ALL ON FUNCTION public.tm_record_action_versions(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.tm_record_action(p_staff uuid,p_id uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; presence jsonb; document_id uuid; doc_label text;
BEGIN
 IF p_action='label_document' THEN
  -- Delegation checks the staff role/practice and locks the consultation before returning.
  result:=public.tm_record_action_versions(p_staff,p_id,'read','{}');
  IF NOT coalesce((result->>'can_edit')::boolean,false) THEN
   IF result->'finalization' IS NOT NULL AND result->'finalization'<>'null'::jsonb THEN RAISE EXCEPTION 'record_finalized'; END IF;
   RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  document_id:=(p_data->>'document_id')::uuid; doc_label:=btrim(p_data->>'label');
  IF doc_label IS NULL OR length(doc_label)>200 OR doc_label ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_document_label'; END IF;
  UPDATE public.uploaded_documents SET label=doc_label WHERE id=document_id AND consultation_id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  INSERT INTO public.audit_logs(practice_id,consultation_id,actor_id,actor_role,action,metadata)
   SELECT practice_id,p_id,id,role,'document_label_changed',jsonb_build_object('document_id',document_id)
   FROM public.staff WHERE id=p_staff;
  RETURN jsonb_build_object('document_id',document_id,'label',doc_label);
 END IF;
 result:=public.tm_record_action_versions(p_staff,p_id,p_action,p_data);
 IF p_action='read' THEN
  SELECT jsonb_build_object('active',status IN ('waiting','admitted') AND updated_at>now()-interval '60 seconds',
    'status',status,'last_seen_at',updated_at) INTO presence
   FROM public.waiting_room_sessions WHERE consultation_id=p_id ORDER BY updated_at DESC LIMIT 1;
  result:=result||jsonb_build_object('patient_presence',coalesce(presence,jsonb_build_object('active',false)));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.tm_record_action(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tm_record_action(uuid,uuid,text,jsonb), public.tm_record_action_versions(uuid,uuid,text,jsonb) TO service_role;
