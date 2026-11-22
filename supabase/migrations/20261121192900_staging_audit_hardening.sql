begin;

-- This function is invoked by the event trigger, not by PostgREST clients.
do $$begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;

alter table neo_private.system_ai_calls add column agent_id uuid;
alter table neo_private.system_ai_calls add column environment text not null default 'staging';
create table neo_private.system_monitor_runs (
 id bigint generated always as identity primary key, occurred_at timestamptz not null default now(),
 outcome text not null check(outcome in ('ok','failed'))
);
create index system_monitor_runs_time_idx on neo_private.system_monitor_runs(occurred_at);
alter table neo_private.system_monitor_runs enable row level security;
revoke all on neo_private.system_monitor_runs from public,anon,authenticated;

create or replace function public.neo_system_ai_record(p_call jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
 v_provider text:=p_call->>'provider'; v_model text:=p_call->>'model'; status text:=p_call->>'status';
 t timestamptz:=statement_timestamp(); p neo_private.system_ai_prices%rowtype;
 i bigint:=(p_call->>'input_tokens')::bigint; o bigint:=(p_call->>'output_tokens')::bigint;
 c bigint:=(p_call->>'cached_tokens')::bigint; cost numeric; no_cache numeric; v_agent uuid;
begin
 if v_provider not in ('openai','gemini','claude') or v_model !~ '^[-A-Za-z0-9._:]{1,100}$'
 or status not in ('ok','error','cancelled','timeout') then raise exception 'Observação inválida.';end if;
 if i<0 or o<0 or c<0 or c>i or (p_call->>'reasoning_tokens')::bigint<0 or (p_call->>'total_tokens')::bigint<0 then
  raise exception 'Contagem inválida.';
 end if;
 if v_provider='openai' and i is not null and o is not null then
  select * into p from neo_private.system_ai_prices q
  where q.provider=v_provider and q.model=v_model and q.effective_from<=(t at time zone 'UTC')::date
  order by q.effective_from desc limit 1;
  if found then
   no_cache:=(i*p.input_per_million+o*p.output_per_million)/1000000;
   if c is not null and (c=0 or p.cached_per_million is not null) then
    cost:=((i-c)*p.input_per_million+o*p.output_per_million+c*coalesce(p.cached_per_million,0))/1000000;
   end if;
  end if;
 end if;
 if p_call->>'job_id' is not null then
  select j.agent_id into v_agent from neo_private.ai_jobs j where j.id=(p_call->>'job_id')::uuid;
 end if;
 insert into neo_private.system_ai_calls(id,observed_at,provider,model,feature,status,duration_ms,agent_id,environment,
  input_tokens,output_tokens,cached_tokens,reasoning_tokens,total_tokens,price_date,currency,estimated_cost,estimated_no_cache)
 values((p_call->>'id')::uuid,t,v_provider,v_model,case when v_agent is null then 'support' else 'agent_support' end,status,
  greatest(0,least(600000,(p_call->>'duration_ms')::integer)),v_agent,'staging',i,o,c,(p_call->>'reasoning_tokens')::bigint,
  (p_call->>'total_tokens')::bigint,p.effective_from,p.currency,cost,no_cache)
 on conflict(id) do nothing;
 delete from neo_private.system_ai_calls where id in (
  select id from neo_private.system_ai_calls where observed_at<t-interval '180 days' order by observed_at limit 100);
end $$;

create or replace function public.neo_admin_system(p_action text default 'snapshot',p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp(); today date:=(t at time zone 'UTC')::date;
 last_sample neo_private.system_monitor_snapshots%rowtype; sample jsonb; r text; amount numeric; a numeric; w numeric; c numeric;
 v_provider text; v_model text; v_currency text; result jsonb; scheduled boolean:=false;
begin
 if p_action in ('scheduled_snapshot','scheduled_failure') and auth.role()='service_role' then
  if p_action='scheduled_failure' then
   insert into neo_private.system_monitor_runs(outcome) values('failed');
   return '{"saved":true}'::jsonb;
  end if;
  scheduled:=true;
  p_action:='snapshot';
 elsif u is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members where user_id=u) then
  raise exception 'Acesso de administrador obrigatório.' using errcode='42501';
 end if;
 if p_action='access' then return '{"authorized":true}'::jsonb;end if;
 if p_action='scheduled_status' then
  return jsonb_build_object('runs',(select coalesce(jsonb_agg(row_value order by occurred_at desc),'[]') from
   (select occurred_at,outcome from neo_private.system_monitor_runs where occurred_at>t-interval '180 days' order by occurred_at desc limit 30) row_value));
 end if;
 if p_action='limit' then
  r:=p_payload->>'resource';amount:=(p_payload->>'amount')::numeric;
  a:=coalesce((p_payload->>'attention')::numeric,70);w:=coalesce((p_payload->>'warning')::numeric,85);c:=coalesce((p_payload->>'critical')::numeric,95);
  if r not in ('database_bytes','storage_bytes','ai_budget_usd','ai_budget_brl','egress_cached_bytes','egress_uncached_bytes','auth_mau','realtime_messages','edge_invocations') or amount<=0 or amount>1e18
   or not (0<a and a<w and w<c and c<=100) then raise exception 'Limite inválido.' using errcode='22023';end if;
  insert into neo_private.system_monitor_limits(resource,amount,attention,warning,critical)
   values(r,amount,a,w,c) on conflict(resource) do update set amount=excluded.amount,attention=excluded.attention,
   warning=excluded.warning,critical=excluded.critical,updated_at=t;
 elsif p_action='price' then
  v_provider:=p_payload->>'provider';v_model:=p_payload->>'model';v_currency:=p_payload->>'currency';
  if v_provider is distinct from 'openai' or coalesce(v_model,'') !~ '^[-A-Za-z0-9._:]{1,100}$' or v_currency not in ('USD','BRL')
   then raise exception 'Preço inválido.' using errcode='22023';end if;
  insert into neo_private.system_ai_prices values(v_provider,v_model,(p_payload->>'effective_from')::date,v_currency,
   (p_payload->>'input_per_million')::numeric,(p_payload->>'output_per_million')::numeric,
   (p_payload->>'cached_per_million')::numeric);
  return '{"saved":true}'::jsonb;
 elsif p_action='ai' then
  with calls as (
   select * from neo_private.system_ai_calls where observed_at>=date_trunc('month',t at time zone 'UTC') at time zone 'UTC'
  ), totals as (
   select count(*) calls,count(*) filter(where status='ok') completed,count(*) filter(where status='error') errors,
    count(*) filter(where status='cancelled') cancelled,count(*) filter(where status='timeout') timeouts,
    round(avg(duration_ms)) average_ms,
    case when count(*)>=20 then round(percentile_cont(.50) within group(order by duration_ms)::numeric) end p50,
    case when count(*)>=20 then round(percentile_cont(.95) within group(order by duration_ms)::numeric) end p95,
    case when count(*)>=100 then round(percentile_cont(.99) within group(order by duration_ms)::numeric) end p99,
    sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(cached_tokens) cached_tokens,sum(reasoning_tokens) reasoning_tokens,
    sum(total_tokens) total_tokens,round(avg(total_tokens)) average_tokens,
    sum(input_tokens) filter(where cached_tokens is not null) measured_cache_input,
    sum(input_tokens-cached_tokens) uncached_tokens,count(input_tokens) metered,count(estimated_cost) estimated_count
   from calls
  ), costs as (
   select currency,count(*) priced_calls,sum(estimated_cost) estimated,sum(estimated_no_cache) no_cache
   from calls where estimated_cost is not null group by currency
  ), models as (
   select provider,model,agent_id,feature,environment,count(*) calls,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(total_tokens) total_tokens
   from calls group by 1,2,3,4,5
  ), daily as (
   select (observed_at at time zone 'UTC')::date as day,currency,sum(estimated_cost) estimated from calls
   where estimated_cost is not null group by 1,2
  )
  select to_jsonb(totals)||jsonb_build_object('costs',(select coalesce(jsonb_agg(costs),'[]') from costs),
   'models',(select coalesce(jsonb_agg(models),'[]') from models),'daily',(select coalesce(jsonb_agg(daily order by day),'[]') from daily),
   'prices',(select coalesce(jsonb_agg(p order by effective_from desc),'[]') from (select * from neo_private.system_ai_prices order by effective_from desc limit 50)p),
   'budgets',(select coalesce(jsonb_agg(l),'[]') from neo_private.system_monitor_limits l where resource in ('ai_budget_usd','ai_budget_brl')),
   'observed_at',t,'from',date_trunc('month',t at time zone 'UTC')::date) into result from totals;
  insert into neo_private.system_monitor_alerts(day,resource,severity,used_pct)
  select today,l.resource,case when usage.pct>=100 then 'exceeded' when usage.pct>=l.critical then 'critical'
   when usage.pct>=l.warning then 'warning' else 'attention' end,usage.pct
  from neo_private.system_monitor_limits l cross join lateral jsonb_to_recordset(result->'costs')
   as k(currency text,priced_calls bigint,estimated numeric)
  cross join lateral(select k.estimated/l.amount*100 pct) usage
  where l.resource='ai_budget_'||lower(k.currency) and k.priced_calls=(result->>'calls')::bigint and usage.pct>=l.attention
  on conflict(day,resource,severity) do nothing;
  return result;
 elsif p_action is distinct from 'snapshot' then raise exception 'Ação inválida.' using errcode='22023';
 end if;

 select * into last_sample from neo_private.system_monitor_snapshots order by day desc limit 1;
 if last_sample.observed_at is null or last_sample.observed_at<t-interval '15 minutes' then
  perform pg_advisory_xact_lock(142078315);
  select * into last_sample from neo_private.system_monitor_snapshots order by day desc limit 1;
  if last_sample.observed_at is null or last_sample.observed_at<t-interval '15 minutes' then
   with buckets as (
    select bucket_id bucket,count(*) objects,count(*) filter(where metadata->>'size' ~ '^[0-9]{1,18}$') sized_objects,
     coalesce(sum((metadata->>'size')::numeric) filter(where metadata->>'size' ~ '^[0-9]{1,18}$'),0) bytes
    from storage.objects group by bucket_id
   ), relations as (
    select n.nspname schema_name,c.relname relation,pg_total_relation_size(c.oid) bytes,
     pg_indexes_size(c.oid) index_bytes
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','neo_private','auth','storage')
    order by bytes desc limit 10
   ), errors as (
    select code,sum(count) filter(where day>=today-6) total,
     sum(count) filter(where day between today-13 and today-7) previous,max(day) last_day
    from neo_private.app_errors where day>=today-13 group by code
   ), daily as (
    select day,sum(count) total from neo_private.app_errors where day>=today-6 group by day
   )
   select jsonb_build_object(
    'database_bytes',pg_database_size(current_database()),'connections',(select count(*) from pg_stat_activity where datname=current_database() and backend_type='client backend'),
    'connection_max',current_setting('max_connections')::int,
    'storage_bytes',(select coalesce(sum(bytes),0) from buckets),'storage_objects',(select coalesce(sum(objects),0) from buckets),
    'storage_sized_objects',(select coalesce(sum(sized_objects),0) from buckets),
    'buckets',(select coalesce(jsonb_agg(buckets),'[]') from buckets),
    'relations',(select coalesce(jsonb_agg(relations order by bytes desc),'[]') from relations),
    'errors',(select coalesce(jsonb_agg(errors),'[]') from errors),
    'errors_daily',(select coalesce(jsonb_agg(daily order by day),'[]') from daily)) into sample;
   insert into neo_private.system_monitor_snapshots values(today,t,sample)
    on conflict(day) do update set observed_at=excluded.observed_at,data=excluded.data
    returning * into last_sample;
   delete from neo_private.system_monitor_snapshots where day<today-179;
  end if;
 end if;
 insert into neo_private.system_monitor_alerts(day,resource,severity,used_pct)
 select today,l.resource,case when usage.pct>=l.critical then 'critical' when usage.pct>=l.warning then 'warning' else 'attention' end,usage.pct
 from neo_private.system_monitor_limits l
 cross join lateral(select ((last_sample.data->>l.resource)::numeric/l.amount)*100 pct) usage
 where l.resource in ('database_bytes','storage_bytes') and usage.pct>=l.attention
 and (l.resource<>'storage_bytes' or last_sample.data->>'storage_sized_objects'=last_sample.data->>'storage_objects')
 on conflict(day,resource,severity) do nothing;
 delete from neo_private.system_monitor_alerts where day<today-179;
 if scheduled then
  insert into neo_private.system_monitor_runs(outcome) values('ok');
  delete from neo_private.system_monitor_runs where occurred_at<t-interval '180 days';
  return jsonb_build_object('observed_at',last_sample.observed_at);
 end if;
 return jsonb_build_object('data',last_sample.data,'observed_at',last_sample.observed_at,
  'limits',(select coalesce(jsonb_agg(l),'[]') from neo_private.system_monitor_limits l),
  'alerts',(select coalesce(jsonb_agg(alert_row order by day desc,observed_at desc),'[]') from
   (select * from neo_private.system_monitor_alerts order by day desc,observed_at desc limit 100) alert_row),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('day',h.day,'database_bytes',h.data->'database_bytes',
   'storage_bytes',case when h.data->>'storage_sized_objects'=h.data->>'storage_objects' then h.data->'storage_bytes' end) order by h.day),'[]') from neo_private.system_monitor_snapshots h));
end $$;
create or replace function public.neo_quality_observe(p_metric text,p_duration integer default null,p_revision text default '')
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp();
begin
 if u is null then return false;end if;
 perform 1 from neo_private.audience_observations where user_id=u and engagement_allowed and expires_at>t for update;
 if not found then return false;end if;
 if p_metric is null or p_metric not in ('web_lcp','web_cls','web_inp','initial_load','sync_response','sync_failure','upload_failure','javascript_error','pwa_update_failure')
  or coalesce(p_revision,'') !~ '^([0-9a-f]{7,40})?$'
  or (p_metric in ('web_lcp','web_cls','web_inp','initial_load','sync_response') and (p_duration is null or p_duration not between 0 and 120000))
  or (p_metric not in ('web_lcp','web_cls','web_inp','initial_load','sync_response') and p_duration is not null) then
   raise exception 'Observação inválida.' using errcode='22023';
 end if;
 insert into neo_private.operations_quality(account,bucket,metric,revision,duration_ms)
 values(u,date_trunc('minute',t),p_metric,coalesce(p_revision,''),p_duration) on conflict do nothing;
 delete from neo_private.operations_quality where (account,bucket,metric,revision) in (
  select account,bucket,metric,revision from neo_private.operations_quality where bucket<t-interval '90 days' order by bucket limit 200);
 return true;
end $$;


grant execute on function public.neo_admin_system(text,jsonb) to service_role;

create table neo_private.account_geo (
 user_id uuid primary key references auth.users(id) on delete cascade,
 first_location jsonb, last_location jsonb
);
alter table neo_private.account_geo enable row level security;
revoke all on neo_private.account_geo from public,anon,authenticated;

create function public.neo_geo_control(p_action text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'Sessão obrigatória.' using errcode='42501';end if;
 if p_action='allow' then insert into neo_private.account_geo(user_id) values(u) on conflict do nothing;
 elsif p_action='remove' then delete from neo_private.account_geo where user_id=u;
 elsif p_action is null or p_action not in ('status','export') then raise exception 'Ação inválida.' using errcode='22023';
 end if;
 select case when p_action='export' then to_jsonb(g)-'user_id' else '{}'::jsonb end into result
 from neo_private.account_geo g where user_id=u;
 return coalesce(result,'{}')||jsonb_build_object('allowed',result is not null);
end $$;

create function public.neo_geo_observe(p_user uuid,p_country text,p_region text default null,p_city text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare observation jsonb;
begin
 if p_country is null or p_country !~ '^[A-Z]{2}$'
 or length(p_region)>100 or length(p_city)>120 or coalesce(p_region,'')~'[[:cntrl:]]' or coalesce(p_city,'')~'[[:cntrl:]]'
 then return false;end if;
 observation:=jsonb_strip_nulls(jsonb_build_object('country',p_country,'region',nullif(btrim(p_region),''),
  'city',nullif(btrim(p_city),''),'source','vercel_ip_approximate','observed_at',statement_timestamp()));
 update neo_private.account_geo set first_location=coalesce(first_location,observation),last_location=observation
 where user_id=p_user and (last_location is null or (last_location->>'observed_at')::timestamptz<statement_timestamp()-interval '5 minutes');
 return found;
end $$;

create function public.neo_admin_geo(p_users uuid[])
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members where user_id=u)
 then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
 if p_users is null or cardinality(p_users)>500 then raise exception 'Limite inválido.' using errcode='22023';end if;
 select coalesce(jsonb_object_agg(user_id,to_jsonb(g)-'user_id'),'{}') into result
 from neo_private.account_geo g where user_id=any(p_users) and first_location is not null;
 return result;
end $$;

revoke all on function public.neo_geo_control(text),public.neo_geo_observe(uuid,text,text,text),public.neo_admin_geo(uuid[]) from public,anon,authenticated;
grant execute on function public.neo_geo_control(text),public.neo_admin_geo(uuid[]) to authenticated;
grant execute on function public.neo_geo_observe(uuid,text,text,text) to service_role;

do $$begin
 if to_regclass('neo_private.support_attachments') is not null then
  create index if not exists neo_support_attachments_account_fk on neo_private.support_attachments(user_id);
 end if;
 if to_regclass('neo_private.support_reads') is not null then
  create index if not exists neo_support_reads_account_fk on neo_private.support_reads(user_id);
 end if;
 if to_regclass('neo_private.support_messages') is not null then
  create index if not exists neo_support_messages_sender_fk on neo_private.support_messages(sender_id);
 end if;
 if exists(select 1 from pg_policy where polname='neo_message_events_own' and polrelid=to_regclass('public.neo_message_events')) then
  alter policy neo_message_events_own on public.neo_message_events using (user_id=(select auth.uid()));
 end if;
end $$;

create function public.neo_admin_signup_export(p_query text default '',p_new boolean default false,
 p_from timestamptz default null,p_until timestamptz default null,p_before timestamptz default null,
 p_before_id uuid default null,p_batch timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare caller uuid:=auth.uid(); started timestamptz; needle text:=lower(btrim(coalesce(p_query,''))); payload jsonb;
begin
 if caller is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members a where a.user_id=caller)
 then raise exception 'Acesso de administrador obrigatório.' using errcode='42501';end if;
 if length(needle)>120 or (p_before is null)<>(p_before_id is null)
  or (p_from is not null and p_until is not null and p_from>=p_until) then
  raise exception 'Filtros inválidos.' using errcode='22023';
 end if;
 select started_at into started from neo_private.signup_notice_rollout;
 select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.created_at desc,export_row.id desc),'[]') into payload
 from (
  select u.id,u.email,u.created_at,greatest(u.last_sign_in_at,a.last_seen) last_access,names.full_name,
   case u.raw_app_meta_data->>'provider' when 'email' then 'email' when 'google' then 'google' when 'apple' then 'apple' end provider,
   o.first_device,o.last_device,o.first_campaign,o.last_campaign,g.first_location,g.last_location
  from auth.users u
  left join public.neo_profiles p on p.user_id=u.id
  left join neo_private.activity a on a.user_id=u.id
  left join neo_private.signup_notice_reads r on r.admin_id=caller and r.signup_id=u.id
  left join neo_private.audience_observations o on o.user_id=u.id and o.expires_at>now()
  left join neo_private.account_geo g on g.user_id=u.id
  cross join lateral (select left(coalesce(nullif(btrim(p.data#>>'{profile,name}'),''),
   nullif(btrim(u.raw_user_meta_data->>'full_name'),''),nullif(btrim(u.raw_user_meta_data->>'name'),'')),160) full_name) names
  where u.created_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
   and (p_from is null or u.created_at>=p_from) and (p_until is null or u.created_at<p_until)
   and (p_before is null or (u.created_at,u.id)<(p_before,p_before_id))
   and (not coalesce(p_new,false) or (u.created_at>=started and (r.read_at is null or r.read_at=p_batch)))
   and (needle='' or strpos(lower(coalesce(names.full_name,'')),needle)>0 or strpos(lower(coalesce(u.email,'')),needle)>0)
  order by u.created_at desc,u.id desc limit 251
 ) export_row;
 return jsonb_build_object('rows',payload);
end $$;
revoke all on function public.neo_admin_signup_export(text,boolean,timestamptz,timestamptz,timestamptz,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.neo_admin_signup_export(text,boolean,timestamptz,timestamptz,timestamptz,uuid,timestamptz) to authenticated;
commit;
