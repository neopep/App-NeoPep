-- Candidate, Teste only, after 008 and 014. No scheduler or dispatcher.
begin;
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw' and not drafts_enabled) then raise exception 'wrong_environment_or_gate_enabled';end if;
end $guard$;
alter table neo_private.connect_ai_draft_job_items add column payload jsonb;
alter table neo_private.connect_ai_draft_job_items add constraint connect_ai_payload_shape check(payload is null or (jsonb_typeof(payload)='object' and octet_length(payload::text)<=18000 and payload->>'publicationId'=publication_id::text and payload->>'requestId'=request_id::text));
create function neo_private.connect_ai_job_create_payload(p_connection uuid,p_owner uuid,p_job uuid,p_channel text,p_campaign uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare ids jsonb; r jsonb; existing jsonb;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 60 or octet_length(p_items::text)>1080000 then raise exception 'invalid_job' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_items) v where jsonb_typeof(v)<>'object' or (v-array['publicationId','requestId','title','blocks','plannedLocal'])<>'{}'::jsonb or octet_length(v::text)>18000 or jsonb_typeof(v->'title') is distinct from 'string' or jsonb_typeof(v->'blocks') is distinct from 'array') then raise exception 'invalid_payload' using errcode='22023';end if;
 select jsonb_agg(jsonb_build_object('publicationId',v->>'publicationId','requestId',v->>'requestId') order by n) into ids from jsonb_array_elements(p_items) with ordinality a(v,n);
 r:=neo_private.connect_ai_job_create(p_connection,p_owner,p_job,p_channel,p_campaign,ids);
 if (r->>'reused')::boolean then
  select jsonb_agg(payload order by ordinal) into existing from neo_private.connect_ai_draft_job_items where job_id=p_job;
  if existing is distinct from p_items then raise exception 'payload_conflict' using errcode='23505';end if;
 else
  update neo_private.connect_ai_draft_job_items i set payload=a.v from jsonb_array_elements(p_items) with ordinality a(v,n) where i.job_id=p_job and i.ordinal=a.n-1;
 end if;
 return r;
end $$;
create function neo_private.connect_ai_job_claim_payload(p_connection uuid,p_owner uuid,p_job uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare claimed jsonb; result jsonb;
begin
 claimed:=neo_private.connect_ai_job_claim(p_connection,p_owner,p_job);
 if jsonb_array_length(claimed)=0 then return claimed;end if;
 if exists(select 1 from jsonb_array_elements(claimed) a(v) join neo_private.connect_ai_draft_job_items i on i.job_id=p_job and i.ordinal=(v->>'ordinal')::integer where i.payload is null) then raise exception 'missing_payload' using errcode='55000';end if;
 select jsonb_agg(v||jsonb_build_object('item',i.payload,'channel',j.channel,'campaignId',j.campaign_id) order by i.ordinal)
 into result from jsonb_array_elements(claimed) a(v) join neo_private.connect_ai_draft_job_items i on i.job_id=p_job and i.ordinal=(v->>'ordinal')::integer join neo_private.connect_ai_draft_jobs j on j.id=i.job_id;
 return result;
end $$;
revoke all on function neo_private.connect_ai_job_create_payload(uuid,uuid,uuid,text,uuid,jsonb),neo_private.connect_ai_job_claim_payload(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_job_create_payload(uuid,uuid,uuid,text,uuid,jsonb),neo_private.connect_ai_job_claim_payload(uuid,uuid,uuid) to neo_connect_ai_broker;
commit;
