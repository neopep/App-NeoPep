begin;
create table neo_private.system_monitor_snapshots (
 day date primary key, observed_at timestamptz not null, data jsonb not null
);
create table neo_private.system_monitor_limits (
 resource text primary key, amount numeric not null check(amount>0),
 attention numeric not null, warning numeric not null, critical numeric not null,
 check(0<attention and attention<warning and warning<critical and critical<=100),
 updated_at timestamptz not null default now()
);
create table neo_private.system_ai_prices (
 provider text not null, model text not null, effective_from date not null,
 currency text not null check(currency in ('USD','BRL')),
 input_per_million numeric not null check(input_per_million between 0 and 1000000),
 output_per_million numeric not null check(output_per_million between 0 and 1000000),
 cached_per_million numeric check(cached_per_million>=0 and cached_per_million<=input_per_million),
 primary key(provider,model,effective_from)
);
create table neo_private.system_ai_calls (
 id uuid primary key, observed_at timestamptz not null default now(), provider text not null, model text not null,
 feature text not null, status text not null, duration_ms integer not null,
 input_tokens bigint, output_tokens bigint, cached_tokens bigint, reasoning_tokens bigint, total_tokens bigint,
 price_date date, currency text, estimated_cost numeric, estimated_no_cache numeric
);
create index system_ai_calls_day_idx on neo_private.system_ai_calls(observed_at);
create table neo_private.system_monitor_alerts (
 day date not null, resource text not null, severity text not null, observed_at timestamptz not null default now(),
 used_pct numeric not null, primary key(day,resource,severity)
);
alter table neo_private.system_monitor_snapshots enable row level security;
alter table neo_private.system_monitor_limits enable row level security;
alter table neo_private.system_ai_prices enable row level security;
alter table neo_private.system_ai_calls enable row level security;
alter table neo_private.system_monitor_alerts enable row level security;
revoke all on neo_private.system_monitor_snapshots,neo_private.system_monitor_limits,neo_private.system_ai_prices,
 neo_private.system_ai_calls,neo_private.system_monitor_alerts from public,anon,authenticated;

create function public.neo_system_ai_record(p_call jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
 v_provider text:=p_call->>'provider'; v_model text:=p_call->>'model'; status text:=p_call->>'status';
 t timestamptz:=statement_timestamp(); p neo_private.system_ai_prices%rowtype;
 i bigint:=(p_call->>'input_tokens')::bigint; o bigint:=(p_call->>'output_tokens')::bigint;
 c bigint:=(p_call->>'cached_tokens')::bigint; cost numeric; no_cache numeric;
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
 insert into neo_private.system_ai_calls(id,observed_at,provider,model,feature,status,duration_ms,
  input_tokens,output_tokens,cached_tokens,reasoning_tokens,total_tokens,price_date,currency,estimated_cost,estimated_no_cache)
 values((p_call->>'id')::uuid,t,v_provider,v_model,'support',status,
  greatest(0,least(600000,(p_call->>'duration_ms')::integer)),i,o,c,(p_call->>'reasoning_tokens')::bigint,
  (p_call->>'total_tokens')::bigint,p.effective_from,p.currency,cost,no_cache)
 on conflict(id) do nothing;
 delete from neo_private.system_ai_calls where id in (
  select id from neo_private.system_ai_calls where observed_at<t-interval '180 days' order by observed_at limit 100);
end $$;

create function public.neo_admin_system(p_action text default 'snapshot',p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp(); today date:=(t at time zone 'UTC')::date;
 last_sample neo_private.system_monitor_snapshots%rowtype; sample jsonb; r text; amount numeric; a numeric; w numeric; c numeric;
 v_provider text; v_model text; v_currency text; result jsonb;
begin
 if u is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members where user_id=u) then
  raise exception 'Acesso de administrador obrigatório.' using errcode='42501';
 end if;
 if p_action='access' then return '{"authorized":true}'::jsonb;end if;
 if p_action='limit' then
  r:=p_payload->>'resource';amount:=(p_payload->>'amount')::numeric;
  a:=coalesce((p_payload->>'attention')::numeric,70);w:=coalesce((p_payload->>'warning')::numeric,85);c:=coalesce((p_payload->>'critical')::numeric,95);
  if r not in ('database_bytes','storage_bytes','ai_budget_usd','ai_budget_brl') or amount<=0 or amount>1e18
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
   select provider,model,count(*) calls,sum(input_tokens) input_tokens,sum(output_tokens) output_tokens,sum(total_tokens) total_tokens
   from calls group by 1,2
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
 return jsonb_build_object('data',last_sample.data,'observed_at',last_sample.observed_at,
  'limits',(select coalesce(jsonb_agg(l),'[]') from neo_private.system_monitor_limits l),
  'alerts',(select coalesce(jsonb_agg(alert_row order by day desc,observed_at desc),'[]') from
   (select * from neo_private.system_monitor_alerts order by day desc,observed_at desc limit 100) alert_row),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('day',h.day,'database_bytes',h.data->'database_bytes',
   'storage_bytes',case when h.data->>'storage_sized_objects'=h.data->>'storage_objects' then h.data->'storage_bytes' end) order by h.day),'[]') from neo_private.system_monitor_snapshots h));
end $$;
revoke all on function public.neo_system_ai_record(jsonb),public.neo_admin_system(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_system_ai_record(jsonb) to service_role;
grant execute on function public.neo_admin_system(text,jsonb) to authenticated;
commit;
