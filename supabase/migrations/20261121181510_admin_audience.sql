begin;
create table neo_private.audience_observations (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 first_device jsonb, last_device jsonb,
 first_campaign jsonb, last_campaign jsonb
);
create index audience_observations_expiry_idx on neo_private.audience_observations(expires_at);
alter table neo_private.audience_observations enable row level security;
revoke all on neo_private.audience_observations from public,anon,authenticated;

create function public.neo_audience_self(p_action text,p_device jsonb default null,p_campaign jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp(); d jsonb; c jsonb; result jsonb;
begin
 if u is null then raise exception 'Sessão obrigatória.' using errcode='42501'; end if;
 if p_action='allow' then
  insert into neo_private.audience_observations(user_id,expires_at) values(u,t+interval '90 days')
  on conflict(user_id) do update set expires_at=excluded.expires_at,
   first_device=null,last_device=null,first_campaign=null,last_campaign=null
   where neo_private.audience_observations.expires_at<=t;
 elsif p_action='remove' then
  delete from neo_private.audience_observations where user_id=u;
 elsif p_action='observe' then
  if not exists(select 1 from neo_private.audience_observations where user_id=u and expires_at>t) then
   return jsonb_build_object('allowed',false);
  end if;
  d:=jsonb_strip_nulls(jsonb_build_object(
   'category',case when p_device->>'category' in ('mobile','tablet','desktop') then p_device->>'category' end,
   'os',case when p_device->>'os' in ('iOS','Android','Windows','macOS','Linux') then p_device->>'os' end,
   'browser',case when p_device->>'browser' in ('Safari','Chrome','Edge','Firefox','Opera','Samsung Internet') then p_device->>'browser' end,
   'major',case when p_device->>'browser' in ('Safari','Chrome','Edge','Firefox','Opera','Samsung Internet')
    and p_device->>'major' ~ '^[0-9]{1,3}$' then p_device->>'major' end,
   'context',case when p_device->>'context' in ('pwa','browser') then p_device->>'context' end));
  select jsonb_object_agg(key,value) into c from jsonb_each_text(
   case when jsonb_typeof(p_campaign)='object' then p_campaign else '{}'::jsonb end)
  where (key='referrer' and value in ('Google','Instagram','Facebook','Outra referência'))
   or (key in ('utm_source','utm_medium','utm_campaign','utm_content','utm_term')
    and value ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$');
  if d<>'{}'::jsonb then d:=d||jsonb_build_object('at',t); else d:=null; end if;
  if c is not null then c:=c||jsonb_build_object('at',t); end if;
  update neo_private.audience_observations
  set first_device=coalesce(first_device,d),last_device=coalesce(d,last_device),
      first_campaign=coalesce(first_campaign,c),last_campaign=coalesce(c,last_campaign)
  where user_id=u and expires_at>t and (
   (c is not null and c-'at' is distinct from last_campaign-'at') or
   (d is not null and (d-'at' is distinct from last_device-'at' or (last_device->>'at')::timestamptz<t-interval '5 minutes')));
 elsif p_action not in ('status','export') or p_action is null then
  raise exception 'Ação inválida.' using errcode='22023';
 end if;
 if p_action in ('allow','observe') then
  delete from neo_private.audience_observations where user_id in (
   select user_id from neo_private.audience_observations where expires_at<=t order by expires_at limit 200
  ) and expires_at<=t;
 end if;
 select case when p_action='export' then to_jsonb(o)-'user_id' else '{}'::jsonb end into result
 from neo_private.audience_observations o where o.user_id=u and o.expires_at>t;
 return coalesce(result,'{}'::jsonb)||jsonb_build_object('allowed',result is not null);
end $$;

create function public.neo_admin_audience(p_from date default null,p_to date default null,p_users uuid[] default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); today date:=(now() at time zone 'UTC')::date;
 start_day date:=coalesce(p_from,today-29); end_day date:=coalesce(p_to,today);
 start_at timestamptz; end_at timestamptz; result jsonb;
begin
 if u is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members where user_id=u) then
  raise exception 'Acesso de administrador obrigatório.' using errcode='42501';
 end if;
 if p_users is not null then
  if cardinality(p_users)>20 then raise exception 'Limite de 20 cadastros.' using errcode='22023'; end if;
  select coalesce(jsonb_object_agg(o.user_id,to_jsonb(o)-'user_id'-'expires_at'),'{}'::jsonb)
  into result from neo_private.audience_observations o where o.user_id=any(p_users) and o.expires_at>now();
  return result;
 end if;
 if end_day<start_day or end_day>today or end_day-start_day>365 then raise exception 'Período inválido.' using errcode='22023'; end if;
 start_at:=start_day::timestamp at time zone 'UTC';
 end_at:=(end_day+1)::timestamp at time zone 'UTC';
 with accounts as materialized (
  select a.id,a.created_at,greatest(a.last_sign_in_at,b.last_seen) as last_access
  from auth.users a left join neo_private.activity b on b.user_id=a.id
  where a.created_at is not null and a.deleted_at is null and not coalesce(a.is_anonymous,false)
 ), totals as (
  select count(*) filter(where created_at>=today::timestamp at time zone 'UTC') today,
   count(*) filter(where created_at>=now()-interval '7 days') signups_7,
   count(*) filter(where created_at>=now()-interval '30 days') signups_30,
   count(*) filter(where last_access>=now()-interval '1 day') active_1,
   count(*) filter(where last_access>=now()-interval '7 days') active_7,
   count(*) filter(where last_access>=now()-interval '30 days') active_30,
   count(*) filter(where last_access>=start_at and last_access<end_at and created_at>=start_at) new_active,
   count(*) filter(where last_access>=start_at and last_access<end_at and created_at<start_at) returning_active,
   count(*) filter(where created_at>=start_at and created_at<end_at) period_signups,
   max(last_access) last_access
  from accounts
 ), series as (
  select ((created_at at time zone 'UTC')::date) as day,count(*) n from accounts
  where created_at>=start_at and created_at<end_at group by 1
 ), monthly as (
  select date_trunc('month',day::timestamp)::date as month,sum(n) n from series group by 1
 ), observed as (
  select o.last_device,o.first_campaign from neo_private.audience_observations o join accounts a on a.id=o.user_id
  where o.expires_at>now() and a.created_at>=start_at and a.created_at<end_at
 ), groups as (
  select item.kind,item.label,count(*) n
  from observed cross join lateral (values
   ('os',last_device->>'os'),('device',last_device->>'category'),('browser',last_device->>'browser'),
   ('context',last_device->>'context'),('referral',first_campaign->>'referrer'),
   ('campaign',nullif(concat_ws(' / ',first_campaign->>'utm_source',first_campaign->>'utm_medium',
    first_campaign->>'utm_campaign',first_campaign->>'utm_content'),''))) item(kind,label)
  where item.label is not null group by 1,2 having count(*)>=5
 )
 select to_jsonb(totals)-'new_active'-'returning_active'||jsonb_build_object(
  'new_active',case when new_active=0 or new_active>=5 then new_active end,
  'returning_active',case when returning_active=0 or returning_active>=5 then returning_active end,
  'from',start_day,'to',end_day,
  'daily',(select coalesce(jsonb_agg(jsonb_build_object('label',day,'count',case when n>=5 then n end) order by day),'[]'::jsonb) from series),
  'monthly',(select coalesce(jsonb_agg(jsonb_build_object('label',month,'count',case when n>=5 then n end) order by month),'[]'::jsonb) from monthly),
  'groups',(select coalesce(jsonb_agg(to_jsonb(g) order by g.kind,g.n desc,g.label),'[]'::jsonb) from
    (select *,sum(n) over(partition by kind) as visible_total from groups) g)
 ) into result from totals;
 return result;
end $$;

revoke all on function public.neo_audience_self(text,jsonb,jsonb),public.neo_admin_audience(date,date,uuid[]) from public,anon,authenticated;
grant execute on function public.neo_audience_self(text,jsonb,jsonb),public.neo_admin_audience(date,date,uuid[]) to authenticated;
commit;
