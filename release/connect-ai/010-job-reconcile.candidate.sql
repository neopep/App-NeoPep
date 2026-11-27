-- Candidate only. Do not apply until authenticated read and Teste draft gate are approved.
-- Historical receipt: never implies the publication is still editable or unsent.
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw') then raise exception 'wrong_environment';end if;
end $guard$;
create function neo_private.connect_ai_job_reconcile(p_connection uuid,p_owner uuid,p_job uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare j neo_private.connect_ai_draft_jobs; i neo_private.connect_ai_draft_job_items;
 expected jsonb; blocks jsonb; native neo_private.campaign_editor_versions;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 select * into j from neo_private.connect_ai_draft_jobs where id=p_job and connection_id=p_connection for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 select * into i from neo_private.connect_ai_draft_job_items where job_id=p_job and request_id=p_request for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if i.state<>'uncertain' or i.lease_id is not null or i.leased_until is not null then
  return jsonb_build_object('publicationId',i.publication_id,'state',i.state,'reconciled',false);
 end if;
 -- Compare original immutable payload, not the latest draft or a client-supplied receipt.
 if jsonb_typeof(i.payload) is distinct from 'object' or jsonb_typeof(i.payload->'blocks') is distinct from 'array'
    or i.payload->>'publicationId' is distinct from i.publication_id::text or i.payload->>'requestId' is distinct from i.request_id::text
    or jsonb_typeof(i.payload->'title') is distinct from 'string'
    or (i.payload-array['publicationId','requestId','title','blocks','plannedLocal'])<>'{}'::jsonb
    or (i.payload?'plannedLocal' and jsonb_typeof(i.payload->'plannedLocal') is distinct from 'string') then
  return jsonb_build_object('publicationId',i.publication_id,'state','uncertain','reconciled',false);
 end if;
 if jsonb_array_length(i.payload->'blocks') not between 1 and 6 or exists(
  select 1 from jsonb_array_elements(i.payload->'blocks') b where jsonb_typeof(b)<>'object'
   or (b-array['id','text'])<>'{}'::jsonb or jsonb_typeof(b->'id') is distinct from 'string'
   or jsonb_typeof(b->'text') is distinct from 'string') then
  return jsonb_build_object('publicationId',i.publication_id,'state','uncertain','reconciled',false);
 end if;
 select jsonb_agg(jsonb_build_object('id',b->'id','type','text','text',b->'text') order by n)
 into blocks from jsonb_array_elements(i.payload->'blocks') with ordinality a(b,n);
 expected:=jsonb_build_object('title',btrim(i.payload->>'title'),'blocks',blocks,'groups','[]'::jsonb,'audience','all','timezone','America/Sao_Paulo','planned_local',coalesce(i.payload->>'plannedLocal',''));
 select * into native from neo_private.campaign_editor_versions where request_id=i.request_id and owner_id=p_owner
  and editor_id=i.publication_id and source_id=j.campaign_id and channel=j.channel and revision=1 and draft=expected;
 if not found then
  -- Missing or mismatched evidence is never proof of non-execution. Do not retry.
  return jsonb_build_object('publicationId',i.publication_id,'state','uncertain','reconciled',false);
 end if;
 -- Native request_id is unique; require the Central publication linkage as well.
 if not (case when j.channel='app' then exists(select 1 from neo_private.campaign_app_publications p where p.id=i.publication_id and p.campaign_id=j.campaign_id)
  when j.channel='whatsapp' then exists(select 1 from neo_private.campaign_central_publications p where p.id=i.publication_id and p.editor_id=i.publication_id and p.source_id=j.campaign_id and p.campaign_id=j.campaign_id)
  else false end) then
  return jsonb_build_object('publicationId',i.publication_id,'state','uncertain','reconciled',false);
 end if;
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 update neo_private.connect_ai_draft_job_items set state='saved',revision=native.revision where job_id=p_job and request_id=p_request and state='uncertain';
 insert into neo_private.connect_ai_audit_events(connection_id,action,outcome,request_id) values(p_connection,'item_result','saved',p_request);
 return jsonb_build_object('publicationId',i.publication_id,'state','saved','revision',native.revision,'reconciled',true);
end $fn$;
revoke all on function neo_private.connect_ai_job_reconcile(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_job_reconcile(uuid,uuid,uuid,uuid) to neo_connect_ai_broker;
