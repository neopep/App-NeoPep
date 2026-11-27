-- Teste only, after 015. Private assembly, no sends or scheduling.
begin;
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw' and not drafts_enabled) then raise exception 'wrong_environment_or_gate_enabled';end if;
end $guard$;
create table neo_private.connect_ai_job_assembly(
 id uuid primary key,connection_id uuid not null references neo_private.connect_ai_connections(id) on delete cascade,
 channel text not null check(channel in ('app','whatsapp')),campaign_id uuid not null,
 expected integer not null check(expected between 1 and 60),items jsonb not null default '[]'::jsonb,
 sealed boolean not null default false,expires_at timestamptz not null default now()+interval '24 hours',
 check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=expected and octet_length(items::text)<=1080000)
);
alter table neo_private.connect_ai_job_assembly enable row level security;
revoke all on neo_private.connect_ai_job_assembly from public,anon,authenticated,neo_connect_ai_broker;
create function neo_private.connect_ai_job_assemble(p_connection uuid,p_owner uuid,p_job uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a neo_private.connect_ai_job_assembly; ch text; cid uuid; n integer; pos integer; received integer; incoming jsonb; combined jsonb; prior jsonb;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 if p_action not in ('begin','append','seal','status','abandon') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_assembly' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('connect-ai-job:'||p_job::text,0));
 if p_action='begin' then
  ch:=p_data->>'channel';cid:=(p_data->>'campaignId')::uuid;n:=(p_data->>'expected')::integer;
  if ch is null or ch not in ('app','whatsapp') or cid is null or n is null or n not between 1 and 60 then raise exception 'invalid_assembly' using errcode='22023';end if;
  if not (case when ch='app' then exists(select 1 from neo_private.campaign_app_groups where campaign_id=cid and owner_id=p_owner and deleted_at is null and archived_at is null) else exists(select 1 from neo_private.campaign_central_groups where campaign_id=cid and owner_id=p_owner and deleted_at is null and archived_at is null) end) then raise exception 'forbidden' using errcode='42501';end if;
  -- Serialize quota checks for a connection.
  perform pg_advisory_xact_lock(hashtextextended('connect-ai-assembly:'||p_connection::text,0));
  delete from neo_private.connect_ai_job_assembly where connection_id=p_connection and expires_at<=clock_timestamp();
  select * into a from neo_private.connect_ai_job_assembly where id=p_job;
  if found then
   if row(a.connection_id,a.channel,a.campaign_id,a.expected) is distinct from row(p_connection,ch,cid,n) then raise exception 'assembly_conflict' using errcode='23505';end if;
  else
   if exists(select 1 from neo_private.connect_ai_draft_jobs where id=p_job) then raise exception 'assembly_conflict' using errcode='23505';end if;
   if (select count(*) from neo_private.connect_ai_job_assembly where connection_id=p_connection and not sealed)>=10 then raise exception 'assembly_limit' using errcode='55000';end if;
   insert into neo_private.connect_ai_job_assembly(id,connection_id,channel,campaign_id,expected) values(p_job,p_connection,ch,cid,n) returning * into a;
  end if;
 else
  select * into a from neo_private.connect_ai_job_assembly where id=p_job and connection_id=p_connection;
  if not found or a.expires_at<=clock_timestamp() then raise exception 'forbidden' using errcode='42501';end if;
 end if;
 if p_action='append' then
  if a.sealed then raise exception 'assembly_sealed' using errcode='55000';end if;
  if p_data->>'channel' is distinct from a.channel or p_data->>'campaignId' is distinct from a.campaign_id::text then raise exception 'assembly_conflict' using errcode='23505';end if;
  pos:=(p_data->>'offset')::integer;incoming:=p_data->'items';received:=jsonb_array_length(a.items);
  if pos is null or pos<0 or pos>received or jsonb_typeof(incoming) is distinct from 'array' or jsonb_array_length(incoming) not between 1 and 6 or pos+jsonb_array_length(incoming)>a.expected then raise exception 'invalid_assembly' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(incoming) v where jsonb_typeof(v)<>'object' or nullif(v->>'publicationId','') is null or nullif(v->>'requestId','') is null or octet_length(v::text)>18000) then raise exception 'invalid_payload' using errcode='22023';end if;
  if pos<received then
   select jsonb_agg(v order by ord) into prior from jsonb_array_elements(a.items) with ordinality t(v,ord) where ord>pos and ord<=pos+jsonb_array_length(incoming);
   if prior is distinct from incoming then raise exception 'assembly_conflict' using errcode='23505';end if;
  else
   combined:=a.items||incoming;
   if (select count(distinct (v->>'publicationId')::uuid) from jsonb_array_elements(combined) v)<>jsonb_array_length(combined) or (select count(distinct (v->>'requestId')::uuid) from jsonb_array_elements(combined) v)<>jsonb_array_length(combined) then raise exception 'duplicate_item' using errcode='23505';end if;
   update neo_private.connect_ai_job_assembly set items=combined where id=p_job returning * into a;
  end if;
 elsif p_action='seal' and not a.sealed then
  if jsonb_array_length(a.items)<>a.expected then raise exception 'assembly_incomplete' using errcode='55000';end if;
  perform neo_private.connect_ai_job_create_payload(p_connection,p_owner,p_job,a.channel,a.campaign_id,a.items);
  update neo_private.connect_ai_job_assembly set sealed=true,items='[]'::jsonb where id=p_job returning * into a;
 elsif p_action='abandon' then
  if a.sealed then raise exception 'assembly_sealed' using errcode='55000';end if;
  delete from neo_private.connect_ai_job_assembly where id=p_job;
  return jsonb_build_object('jobId',p_job,'state','abandoned','received',0,'expected',a.expected);
 end if;
 return jsonb_build_object('jobId',p_job,'state',case when a.sealed then 'sealed' else 'assembling' end,'received',case when a.sealed then a.expected else jsonb_array_length(a.items) end,'expected',a.expected);
end $$;
revoke all on function neo_private.connect_ai_job_assemble(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_job_assemble(uuid,uuid,uuid,text,jsonb) to neo_connect_ai_broker;
commit;
