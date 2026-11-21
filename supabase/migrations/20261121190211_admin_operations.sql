begin;
create table neo_private.operations_audit (
 id bigint generated always as identity primary key, occurred_at timestamptz not null default statement_timestamp(),
 actor uuid, action text not null, operation text not null, resource text
);
create index operations_audit_time_idx on neo_private.operations_audit(occurred_at desc);
create table neo_private.operations_review (
 rule text not null, evidence_period text not null, state text not null check(state in ('new','review','resolved','dismissed')),
 updated_at timestamptz not null default now(), primary key(rule,evidence_period)
);
create table neo_private.operations_quality (
 account uuid not null references neo_private.audience_observations(user_id) on delete cascade,
 bucket timestamptz not null, metric text not null, revision text not null, duration_ms integer,
 primary key(account,bucket,metric,revision)
);
create index operations_quality_time_idx on neo_private.operations_quality(bucket);
alter table neo_private.operations_audit enable row level security;
alter table neo_private.operations_review enable row level security;
alter table neo_private.operations_quality enable row level security;
revoke all on neo_private.operations_audit,neo_private.operations_review,neo_private.operations_quality from public,anon,authenticated;

create function neo_private.record_operations_audit() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is not null and exists(select 1 from neo_private.admin_members where user_id=u) then
  insert into neo_private.operations_audit(actor,action,operation,resource)
   values(u,tg_argv[0],lower(tg_op),tg_table_name);
  delete from neo_private.operations_audit where id in (
   select id from neo_private.operations_audit where occurred_at<statement_timestamp()-interval '180 days'
   order by occurred_at limit 100
  );
 end if;
 return null;
end $$;
revoke all on function neo_private.record_operations_audit() from public,anon,authenticated;

do $$
declare item record;
begin
 for item in select * from (values
  ('neo_private','admin_members','permissions'),('neo_private','platform_settings','settings'),('neo_private','community_settings','settings'),('neo_private','system_monitor_limits','limits'),
  ('neo_private','system_ai_prices','ai_prices'),('neo_private','agent_settings','ai_settings'),
  ('neo_private','agents','agents'),('neo_private','ai_integrations','integrations'),
  ('neo_private','shop_settings','commerce'),('neo_private','shop_payment_environments','commerce_integrations'),
  ('neo_private','shop_promotions','commerce'),('neo_private','shop_products','commerce')) t(ns,rel,action)
 loop
  if exists(select 1 from pg_class c where c.oid=to_regclass(format('%I.%I',item.ns,item.rel)) and c.relkind in ('r','p')) then
   execute format('create trigger neo_operations_audit after insert or update or delete on %I.%I
    for each row execute function neo_private.record_operations_audit(%L)',item.ns,item.rel,item.action);
  end if;
 end loop;
end $$;

create function public.neo_quality_observe(p_metric text,p_duration integer default null,p_revision text default '')
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp();
begin
 if u is null then return false;end if;
 perform 1 from neo_private.audience_observations where user_id=u and engagement_allowed and expires_at>t for update;
 if not found then return false;end if;
 if p_metric is null or p_metric not in ('initial_load','sync_response','sync_failure','upload_failure','javascript_error','pwa_update_failure')
  or coalesce(p_revision,'') !~ '^([0-9a-f]{7,40})?$'
  or (p_metric in ('initial_load','sync_response') and (p_duration is null or p_duration not between 0 and 120000))
  or (p_metric not in ('initial_load','sync_response') and p_duration is not null) then
   raise exception 'Observação inválida.' using errcode='22023';
 end if;
 insert into neo_private.operations_quality(account,bucket,metric,revision,duration_ms)
 values(u,date_trunc('minute',t),p_metric,coalesce(p_revision,''),p_duration) on conflict do nothing;
 delete from neo_private.operations_quality where (account,bucket,metric,revision) in (
  select account,bucket,metric,revision from neo_private.operations_quality where bucket<t-interval '90 days' order by bucket limit 200);
 return true;
end $$;

create function neo_private.clear_operations_quality() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.engagement_allowed and not new.engagement_allowed then
  delete from neo_private.operations_quality where account=new.user_id;
 end if;
 return null;
end $$;
revoke all on function neo_private.clear_operations_quality() from public,anon,authenticated;
create trigger neo_clear_quality_on_revocation after update of engagement_allowed on neo_private.audience_observations
 for each row execute function neo_private.clear_operations_quality();

create function public.neo_admin_operations(p_section text,p_days int default 30,p_review jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp(); today date:=(t at time zone 'UTC')::date;
 from_at timestamptz; result jsonb; rule_name text; period_key text; review_state text;
begin
 if u is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members where user_id=u) then
  raise exception 'Acesso de administrador obrigatório.' using errcode='42501';
 end if;
 if p_days is null or p_days not in (7,30,90) then raise exception 'Período inválido.' using errcode='22023';end if;
 from_at:=(today-p_days+1)::timestamp at time zone 'UTC';
 if p_section='review' then
  rule_name:=p_review->>'rule';period_key:=p_review->>'period';review_state:=p_review->>'state';
  if rule_name is null or rule_name not in ('storage_growth','app_errors_growth') or coalesce(period_key,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or review_state is null or review_state not in ('new','review','resolved','dismissed') then
   raise exception 'Revisão inválida.' using errcode='22023';
  end if;
  insert into neo_private.operations_review values(rule_name,period_key,review_state,t)
   on conflict(rule,evidence_period) do update set state=excluded.state,updated_at=excluded.updated_at;
  insert into neo_private.operations_audit(actor,action,operation,resource) values(u,'recommendation','update',rule_name);
  result:=jsonb_build_object('saved',true);
 elsif p_section='audit' then
  select jsonb_build_object('entries',coalesce(jsonb_agg(audit_row order by occurred_at desc,id desc),'[]')) into result
  from(select id,occurred_at,actor,action,operation,resource from neo_private.operations_audit
   where occurred_at>=from_at order by occurred_at desc,id desc limit 100) audit_row;
 elsif p_section='routines' then
  if to_regclass('cron.job') is null or to_regclass('cron.job_run_details') is null then
   result:=jsonb_build_object('source_available',false,'jobs','[]'::jsonb);
  else
   execute $jobs$
    select jsonb_build_object('source_available',true,'jobs',coalesce(jsonb_agg(job_rows order by job),'[]'))
    from(select j.jobname job,j.schedule,j.active,
     max(r.start_time) as last_started,max(r.end_time) filter(where r.status='succeeded') as last_success,
     count(*) filter(where r.status='failed') failures,
     (array_agg(r.status order by r.start_time desc) filter(where r.start_time is not null))[1] as last_status,
     (array_agg(extract(epoch from (r.end_time-r.start_time)) order by r.start_time desc) filter(where r.start_time is not null))[1] as last_seconds
     from cron.job j left join cron.job_run_details r on r.jobid=j.jobid and r.start_time>=$1
     where j.jobname ~ '^neo[-_][a-z0-9_-]{1,60}$' group by j.jobname,j.schedule,j.active) job_rows
   $jobs$ into result using from_at;
  end if;
 elsif p_section='quality' then
  with visible as materialized (
   select q.*,o.last_device from neo_private.operations_quality q join neo_private.audience_observations o on o.user_id=q.account
   where q.bucket>=greatest(from_at,t-interval '90 days') and o.engagement_allowed and o.expires_at>t
  ), metrics as (
   select metric,count(*) samples,count(distinct account) users,round(avg(duration_ms)) avg_ms,
    round(percentile_cont(.75) within group(order by duration_ms)::numeric) p75_ms
   from visible group by metric having count(distinct account)>=5
  ), segments as (
   select metric,kind,label,count(*) samples
   from visible cross join lateral(values ('Navegador',last_device->>'browser'),('Sistema',last_device->>'os'),('Versão',nullif(revision,''))) s(kind,label)
   where label is not null and duration_ms is null group by 1,2,3 having count(distinct account)>=5
  )
  select jsonb_build_object('metrics',(select coalesce(jsonb_agg(m order by metric),'[]') from metrics m),
   'segments',(select coalesce(jsonb_agg(g order by kind,samples desc),'[]') from segments g)) into result;
 elsif p_section='insights' then
  with snapshots as (
   select day,(data->>'storage_bytes')::numeric bytes from neo_private.system_monitor_snapshots
   where day>=today-29 and data->>'storage_sized_objects'=data->>'storage_objects'
  ), measured as (
   select count(*) n,min(day) first_day,max(day) last_day,
    (array_agg(bytes order by day))[1] first_bytes,(array_agg(bytes order by day desc))[1] last_bytes from snapshots
  ), errors as (
   select coalesce(sum(count) filter(where day>=today-6),0) recent,
    coalesce(sum(count) filter(where day between today-13 and today-7),0) previous
   from neo_private.app_errors where day>=today-13
  ), recommendations as (
   select 'storage_growth' rule,first_day::text||':'||last_day as evidence_period,first_bytes baseline,last_bytes measured,'bytes' unit
   from measured where n>=3 and last_day-first_day>=7 and first_bytes>0 and last_bytes>=first_bytes*1.20
   union all
   select 'app_errors_growth',(today-13)::text||':'||today,previous,recent,'errors'
   from errors where previous>=5 and recent>=10 and recent>=2*previous
  )
  select jsonb_build_object('recommendations',coalesce(jsonb_agg(to_jsonb(rec)||jsonb_build_object('state',coalesce(r.state,'new'))),'[]'))
   into result from recommendations rec left join neo_private.operations_review r using(rule,evidence_period);
 elsif p_section='journeys' then
  with activity as materialized (
   select e.account,e.session_id,e.occurred_at,e.event,a.created_at,
    (e.occurred_at at time zone 'UTC')::date as utc_day,(a.created_at at time zone 'UTC')::date as signup_day
   from neo_private.engagement_events e join neo_private.audience_observations o on o.user_id=e.account
    join auth.users a on a.id=e.account
   where e.occurred_at>=greatest(t-interval '90 days',from_at-interval '60 days')
    and e.occurred_at<=t and o.engagement_allowed and o.expires_at>t and e.occurred_at>=a.created_at and a.deleted_at is null
  ), starts as (
   select account,min(occurred_at) first_at,min(signup_day) signup_day,min(created_at) signup_at
   from activity group by account
  ), journey as (
   select s.account,s.first_at,s.signup_at,
    min(a.occurred_at) filter(where event='onboarding_completed') onboarding,
    min(a.occurred_at) filter(where event='weight_record_created') weight,
    min(a.occurred_at) filter(where event='calculator_view') calculator,
    min(a.occurred_at) filter(where event in ('photo_upload_success','photo_comparison_started')) photos,
    min(a.occurred_at) filter(where event in ('community_post_created','community_message_sent','community_post_interaction')) community,
    min(a.occurred_at) filter(where event='shop_view') shop,
    min(a.occurred_at) filter(where event='checkout_started') checkout,
    min(a.occurred_at) filter(where a.utc_day>(s.first_at at time zone 'UTC')::date) returned
   from starts s join activity a using(account)
   where s.first_at>=from_at and (s.first_at at time zone 'UTC')::date=s.signup_day
   group by s.account,s.first_at,s.signup_at
  ), milestones as (
   select label,count(*) started,count(at) reached,
    round(avg(extract(epoch from at-baseline)) filter(where at is not null)) avg_seconds
   from journey j cross join lateral(values ('Primeira atividade',first_at,signup_at),
    ('Onboarding',onboarding,first_at),('Primeiro peso',weight,first_at),('Calculadora',calculator,first_at),('Fotografias',photos,first_at),
    ('Interação na comunidade',community,first_at),('Visita à loja',shop,first_at),
    ('Checkout após visita',case when checkout>=shop then checkout end,shop),
    ('Retorno em outro dia',returned,first_at)) stages(label,at,baseline)
   where baseline is not null group by label having count(*)>=5
  ), user_days as (select distinct account,utc_day from activity),
  cohort_users as (
   select s.account,s.signup_day,
    bool_or(d.utc_day=s.signup_day+1) d1,bool_or(d.utc_day=s.signup_day+7) d7,bool_or(d.utc_day=s.signup_day+30) d30,
    bool_or(d.utc_day between s.signup_day+7 and s.signup_day+13) weekly,
    bool_or(d.utc_day between s.signup_day+30 and s.signup_day+59) monthly
   from starts s join user_days d using(account)
   where s.signup_day>=today-p_days+1 and (s.first_at at time zone 'UTC')::date=s.signup_day
   group by s.account,s.signup_day
  ), cohorts as (
   select date_trunc('week',signup_day::timestamp)::date cohort,count(*) accounts,max(signup_day) latest_signup,
    count(*) filter(where signup_day+1<today) d1_base,count(*) filter(where signup_day+1<today and d1) d1,
    count(*) filter(where signup_day+7<today) d7_base,count(*) filter(where signup_day+7<today and d7) d7,
    count(*) filter(where signup_day+30<today) d30_base,count(*) filter(where signup_day+30<today and d30) d30,
    count(*) filter(where signup_day+13<today) weekly_base,count(*) filter(where signup_day+13<today and weekly) weekly,
    count(*) filter(where signup_day+59<today) monthly_base,count(*) filter(where signup_day+59<today and monthly) monthly
   from cohort_users group by 1 having count(*)>=5
  ), all_sessions as (
   select account,session_id,min(occurred_at) start_at,min(signup_day) signup_day from activity group by account,session_id
  ), gaps as (
   select *,lag(start_at) over(partition by account order by start_at,session_id) prior from all_sessions
  ), period_sessions as (
   select * from gaps where start_at>=from_at
  ), per_user as (
   select distinct on(account) account,signup_day,start_at,prior from period_sessions order by account,start_at,session_id
  ), recurrent as (
   select count(*) users, count(*) filter(where signup_day>=today-p_days+1) new_users,
    count(*) filter(where signup_day<today-p_days+1 and prior is not null and start_at-prior<interval '30 days') recurring,
    count(*) filter(where signup_day<today-p_days+1 and start_at-prior>=interval '30 days') reactivated,
    count(*) filter(where signup_day<today-p_days+1 and prior is null) unknown
   from per_user
  )
  select jsonb_build_object(
   'milestones',(select coalesce(jsonb_agg(jsonb_build_object('label',label,'started',started,
    'reached',case when reached>=5 then reached end,'avg_seconds',case when reached>=5 then avg_seconds end)),'[]') from milestones),
   'cohorts',(select coalesce(jsonb_agg(jsonb_build_object('cohort',cohort,'accounts',accounts,
    'd1',case when latest_signup+1<today and d1_base>=5 and d1>=5 then round(100.0*d1/d1_base,1) end,
    'd7',case when latest_signup+7<today and d7_base>=5 and d7>=5 then round(100.0*d7/d7_base,1) end,
    'd30',case when latest_signup+30<today and d30_base>=5 and d30>=5 then round(100.0*d30/d30_base,1) end,
    'weekly',case when latest_signup+13<today and weekly_base>=5 and weekly>=5 then round(100.0*weekly/weekly_base,1) end,
    'monthly',case when latest_signup+59<today and monthly_base>=5 and monthly>=5 then round(100.0*monthly/monthly_base,1) end) order by cohort),'[]') from cohorts),
   'frequency',(select jsonb_build_object('users',users,'new',case when new_users>=5 then new_users end,
    'recurring',case when recurring>=5 then recurring end,'reactivated',case when reactivated>=5 then reactivated end,
    'unknown',case when unknown>=5 then unknown end,
    'sessions',(select count(*) from period_sessions),
    'sessions_per_user',(select case when users>=5 then round(count(*)::numeric/users,2) end from period_sessions),
    'avg_gap_seconds',(select case when count(distinct account)>=5 then round(avg(extract(epoch from(start_at-prior)))) end from period_sessions where prior is not null))
    from recurrent)
  ) into result;
 else raise exception 'Seção inválida.' using errcode='22023';
 end if;
 return coalesce(result,'{}'::jsonb)||jsonb_build_object('from',from_at,'observed_at',t);
end $$;
revoke all on function public.neo_quality_observe(text,integer,text),public.neo_admin_operations(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.neo_quality_observe(text,integer,text),public.neo_admin_operations(text,integer,jsonb) to authenticated;
commit;
