-- Candidate only: do not apply without staging verification.
begin;
create table if not exists neo_private.campaign_ai_requests(
 actor_id uuid not null,
 request_id uuid not null,
 integration_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
alter table neo_private.campaign_ai_requests enable row level security;
revoke all on neo_private.campaign_ai_requests from public,anon,authenticated;
-- Only authenticated campaign administrators may reserve a paid generation.
create or replace function public.neo_campaign_ai_access_v1(p_action text,p_integration uuid default null,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare actor uuid:=auth.uid(); conn neo_private.ai_integrations; changed integer;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then raise exception 'campaign_ai_admin_required' using errcode='42501';end if;
 if p_action='status' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'provider',i.provider,'model',i.model,'name',i.name,'revision',i.revision) order by i.created_at,i.id) from neo_private.ai_integrations i where i.provider='gemini' and i.model<>'' and i.encrypted_key is not null and i.validated_at is not null and i.validated_revision=i.revision),'[]'::jsonb);
 end if;
 if p_action<>'reserve' or p_integration is null or p_request is null then raise exception 'campaign_ai_invalid_request';end if;
 select * into conn from neo_private.ai_integrations i where i.id=p_integration and i.provider='gemini' and i.model<>'' and i.encrypted_key is not null and i.validated_at is not null and i.validated_revision=i.revision;
 if not found then raise exception 'campaign_ai_integration_not_validated';end if;
 -- Serialize per actor, enforce a separate limit from support agents.
 perform pg_advisory_xact_lock(hashtextextended('campaign_ai:'||actor::text,0));
 if exists(select 1 from neo_private.campaign_ai_requests r where r.actor_id=actor and r.request_id=p_request) then raise exception 'campaign_ai_request_already_reserved';end if;
 if not neo_private.take_limit('campaign_ai_minute',3,60) or not neo_private.take_limit('campaign_ai_day',20,86400) then raise exception 'campaign_ai_limit';end if;
 insert into neo_private.campaign_ai_requests(actor_id,request_id,integration_id) values(actor,p_request,p_integration);
 return jsonb_build_object('id',conn.id,'provider',conn.provider,'model',conn.model,'revision',conn.revision);
end
$fn$;
revoke all on function public.neo_campaign_ai_access_v1(text,uuid,uuid) from public,anon;
grant execute on function public.neo_campaign_ai_access_v1(text,uuid,uuid) to authenticated;
-- Do not label these calls as support or share raw briefs with monitoring.
create or replace function public.neo_campaign_ai_record_v1(p_call jsonb)
returns void language plpgsql security definer set search_path=pg_catalog
as $fn$
declare model text:=p_call->>'model'; status text:=p_call->>'status';
 i bigint:=(p_call->>'input_tokens')::bigint; o bigint:=(p_call->>'output_tokens')::bigint;
 c bigint:=(p_call->>'cached_tokens')::bigint; t bigint:=(p_call->>'total_tokens')::bigint;
 r bigint:=(p_call->>'reasoning_tokens')::bigint;
begin
 if model is null or model !~ '^[-A-Za-z0-9._:]{1,100}$' or status is null or status not in ('ok','error','timeout') or i<0 or o<0 or c<0 or c>i or t<0 or r<0 or p_call->>'environment' not in ('production','staging') then raise exception 'campaign_ai_observation_invalid';end if;
 insert into neo_private.system_ai_calls(id,provider,model,feature,status,duration_ms,environment,input_tokens,output_tokens,cached_tokens,reasoning_tokens,total_tokens)
 values((p_call->>'id')::uuid,'gemini',model,'campaign_generation',status,greatest(0,least(600000,(p_call->>'duration_ms')::int)),p_call->>'environment',i,o,c,r,t)
 on conflict(id) do nothing;
end
$fn$;
revoke all on function public.neo_campaign_ai_record_v1(jsonb) from public,anon,authenticated;
grant execute on function public.neo_campaign_ai_record_v1(jsonb) to service_role;
commit;
