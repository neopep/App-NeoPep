-- Candidate: isolated Teste, after 001–003 and 007. No dispatcher or storage writes.
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw') then raise exception 'wrong_environment';end if;
end $guard$;
create table neo_private.connect_ai_draft_jobs(
 id uuid primary key, connection_id uuid not null references neo_private.connect_ai_connections(id) on delete cascade,
 channel text not null check(channel in ('app','whatsapp')), campaign_id uuid not null,
 created_at timestamptz not null default now()
);
create table neo_private.connect_ai_draft_job_items(
 job_id uuid not null references neo_private.connect_ai_draft_jobs(id) on delete cascade,
 ordinal integer not null check(ordinal between 0 and 59), publication_id uuid not null, request_id uuid not null,
 state text not null default 'pending' check(state in ('pending','leased','saved','conflict','blocked','uncertain','retryable')),
 attempts integer not null default 0 check(attempts>=0), revision integer, lease_id uuid, leased_until timestamptz,
 primary key(job_id,ordinal),unique(job_id,publication_id),unique(job_id,request_id)
);
create table neo_private.connect_ai_audit_events(
 id bigint generated always as identity primary key,
 connection_id uuid not null references neo_private.connect_ai_connections(id) on delete cascade,
 action text not null check(action in ('job_created','chunk_claimed','item_result','draft_create','draft_add','draft_edit')),
 outcome text not null check(outcome in ('accepted','saved','conflict','blocked','uncertain','retryable')),
 request_id uuid, recorded_at timestamptz not null default now()
);
alter table neo_private.connect_ai_draft_jobs enable row level security;
alter table neo_private.connect_ai_draft_job_items enable row level security;
alter table neo_private.connect_ai_audit_events enable row level security;
revoke all on neo_private.connect_ai_draft_jobs,neo_private.connect_ai_draft_job_items,neo_private.connect_ai_audit_events from public,anon,authenticated,neo_connect_ai_broker;
-- The runtime must still revalidate NeoPep session/admin and campaign ownership before calling.
create function neo_private.connect_ai_job_check(p_connection uuid,p_owner uuid)
returns boolean language sql security definer set search_path=pg_catalog as $$
 select exists(select 1 from neo_private.connect_ai_connections c where c.id=p_connection and c.owner_id=p_owner and c.revoked_at is null and c.expires_at>clock_timestamp() and c.scopes@>array['campaigns:read','campaigns:drafts']::text[])
$$;
create function neo_private.connect_ai_job_create(p_connection uuid,p_owner uuid,p_job uuid,p_channel text,p_campaign uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare item jsonb; n integer:=0; j neo_private.connect_ai_draft_jobs; existing jsonb;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 if p_channel not in ('app','whatsapp') or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'invalid_job' using errcode='22023';end if;
 if not (case when p_channel='app' then exists(select 1 from neo_private.campaign_app_groups where campaign_id=p_campaign and owner_id=p_owner and deleted_at is null and archived_at is null) else exists(select 1 from neo_private.campaign_central_groups where campaign_id=p_campaign and owner_id=p_owner and deleted_at is null and archived_at is null) end) then raise exception 'forbidden' using errcode='42501';end if;
 if exists(select 1 from jsonb_array_elements(p_items) v where jsonb_typeof(v)<>'object' or (v-array['publicationId','requestId'])<>'{}'::jsonb or nullif(v->>'publicationId','') is null or nullif(v->>'requestId','') is null) then raise exception 'invalid_job' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('connect-ai-job:'||p_job::text,0));
 select * into j from neo_private.connect_ai_draft_jobs where id=p_job;
 if found then
  if row(j.connection_id,j.channel,j.campaign_id) is distinct from row(p_connection,p_channel,p_campaign) then raise exception 'job_conflict' using errcode='23505';end if;
  select jsonb_agg(jsonb_build_object('publicationId',publication_id,'requestId',request_id) order by ordinal) into existing from neo_private.connect_ai_draft_job_items where job_id=p_job;
  if existing is distinct from p_items then raise exception 'job_conflict' using errcode='23505';end if;
  return jsonb_build_object('id',p_job,'reused',true);
 end if;
 insert into neo_private.connect_ai_draft_jobs(id,connection_id,channel,campaign_id) values(p_job,p_connection,p_channel,p_campaign);
 for item in select value from jsonb_array_elements(p_items) loop
  insert into neo_private.connect_ai_draft_job_items(job_id,ordinal,publication_id,request_id) values(p_job,n,(item->>'publicationId')::uuid,(item->>'requestId')::uuid);
  n:=n+1;
 end loop;
 insert into neo_private.connect_ai_audit_events(connection_id,action,outcome,request_id) values(p_connection,'job_created','accepted',p_job);
 return jsonb_build_object('id',p_job,'reused',false);
end $$;
create function neo_private.connect_ai_job_claim(p_connection uuid,p_owner uuid,p_job uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare lease uuid:=gen_random_uuid(); result jsonb;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) or not exists(select 1 from neo_private.connect_ai_draft_jobs where id=p_job and connection_id=p_connection) then raise exception 'forbidden' using errcode='42501';end if;
 -- A timed-out lease is uncertain, NOT automatically retried.
 update neo_private.connect_ai_draft_job_items set state='uncertain',lease_id=null,leased_until=null where job_id=p_job and state='leased' and leased_until<=clock_timestamp();
 with chosen as (select ordinal from neo_private.connect_ai_draft_job_items where job_id=p_job and state in ('pending','retryable') order by ordinal limit 6 for update skip locked),
 updated as (update neo_private.connect_ai_draft_job_items i set state='leased',attempts=attempts+1,lease_id=lease,leased_until=clock_timestamp()+interval '2 minutes' from chosen c where i.job_id=p_job and i.ordinal=c.ordinal returning i.ordinal,i.publication_id,i.request_id)
 select coalesce(jsonb_agg(jsonb_build_object('ordinal',ordinal,'publicationId',publication_id,'requestId',request_id,'leaseId',lease) order by ordinal),'[]'::jsonb) into result from updated;
 if jsonb_array_length(result)>0 then insert into neo_private.connect_ai_audit_events(connection_id,action,outcome,request_id) values(p_connection,'chunk_claimed','accepted',p_job);end if;
 return result;
end $$;
create function neo_private.connect_ai_job_result(p_connection uuid,p_owner uuid,p_job uuid,p_request uuid,p_lease uuid,p_outcome text,p_revision integer default null)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) or not exists(select 1 from neo_private.connect_ai_draft_jobs where id=p_job and connection_id=p_connection) then raise exception 'forbidden' using errcode='42501';end if;
 if p_outcome not in ('saved','conflict','blocked','uncertain','retryable') or (p_outcome='saved' and coalesce(p_revision,0)<1) then raise exception 'invalid_result' using errcode='22023';end if;
 update neo_private.connect_ai_draft_job_items set state=p_outcome,revision=case when p_outcome='saved' then p_revision else null end,lease_id=null,leased_until=null
 where job_id=p_job and request_id=p_request and state='leased' and lease_id=p_lease and leased_until>clock_timestamp();
 if not found then return false;end if;
 insert into neo_private.connect_ai_audit_events(connection_id,action,outcome,request_id) values(p_connection,'item_result',p_outcome,p_request);
 return true;
end $$;
revoke all on function neo_private.connect_ai_job_check(uuid,uuid),neo_private.connect_ai_job_create(uuid,uuid,uuid,text,uuid,jsonb),neo_private.connect_ai_job_claim(uuid,uuid,uuid),neo_private.connect_ai_job_result(uuid,uuid,uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_job_create(uuid,uuid,uuid,text,uuid,jsonb),neo_private.connect_ai_job_claim(uuid,uuid,uuid),neo_private.connect_ai_job_result(uuid,uuid,uuid,uuid,uuid,text,integer) to neo_connect_ai_broker;
