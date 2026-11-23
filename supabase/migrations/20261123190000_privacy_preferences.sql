begin;
-- Keep the existing statistics expiry and independently expire usage consent.
alter table neo_private.audience_observations add column engagement_expires_at timestamptz;
update neo_private.audience_observations set engagement_expires_at=expires_at where engagement_allowed;

create table neo_private.privacy_setup (
 user_id uuid primary key references auth.users(id) on delete cascade,
 completed_at timestamptz
);
alter table neo_private.privacy_setup enable row level security;
revoke all on neo_private.privacy_setup from public,anon,authenticated;

create or replace function public.neo_audience_self(p_action text,p_device jsonb default null,p_campaign jsonb default null)
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
  update neo_private.audience_observations
  set expires_at='-infinity',first_device=null,last_device=null,first_campaign=null,last_campaign=null
  where user_id=u;
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
   select user_id from neo_private.audience_observations where expires_at<=t and coalesce(engagement_expires_at,'-infinity')<=t order by expires_at limit 200 for update skip locked
  ) and expires_at<=t and coalesce(engagement_expires_at,'-infinity')<=t;
 end if;
 select case when p_action='export' then to_jsonb(o)-'user_id'-'engagement_expires_at' else '{}'::jsonb end into result
 from neo_private.audience_observations o where o.user_id=u and o.expires_at>t;
 return coalesce(result,'{}'::jsonb)||jsonb_build_object('allowed',result is not null);
end $$;

create or replace function public.neo_engagement(p_action text,p_events jsonb default '[]')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 u uuid:=auth.uid(); t timestamptz:=statement_timestamp(); accepted integer:=0;
 supported constant jsonb := '{
 "inicio":"home_view home_quick_action home_journey_expand home_library_open",
 "evolucao":"evolution_view weight_chart_interaction comparison_period_changed",
 "registros":"records_view","diario":"journal_view","aplicacoes":"application_view","protocolos":"protocols_view",
 "fotos":"photos_view photo_upload_success photo_history_open photo_comparison_started photo_selected",
 "calculadora":"calculator_view calculator_started calculator_completed calculator_validation_error",
 "relatorios":"reports_view reports_period_changed reports_csv_export reports_print_requested",
 "calendario":"calendar_view calendar_period_changed calendar_event_open",
 "lembretes":"reminders_view reminder_settings_saved","perfil":"profile_view profile_updated",
 "onboarding":"onboarding_completed",
 "comunidade":"community_view community_feed_view community_post_created community_post_interaction community_chat_open community_message_sent community_members_view community_library_view community_material_open",
 "loja":"shop_view product_list_view product_detail_view cart_add checkout_started checkout_step_completed order_created",
 "suporte":"support_view support_message_sent support_attachment_used"
 }';
begin
 if u is null then raise exception 'Sessão obrigatória.' using errcode='42501';end if;
 if p_action='enable' then
  insert into neo_private.audience_observations(user_id,expires_at,engagement_allowed,engagement_expires_at)
  values(u,'-infinity',true,t+interval '90 days')
  on conflict(user_id) do update set engagement_allowed=true,engagement_expires_at=excluded.engagement_expires_at
  where neo_private.audience_observations.engagement_expires_at is null
     or neo_private.audience_observations.engagement_expires_at<=t;
 elsif p_action='disable' then
  update neo_private.audience_observations set engagement_allowed=false,engagement_expires_at=null where user_id=u;
  delete from neo_private.engagement_events where account=u;
 elsif p_action='record' then
  -- Serialize consent revocation with ingestion for this account.
  perform 1 from neo_private.audience_observations where user_id=u and engagement_expires_at>t and engagement_allowed for update;
  if not found then return jsonb_build_object('allowed',false,'accepted',0);end if;
  if jsonb_typeof(p_events) is distinct from 'array' or pg_column_size(p_events)>27000 then raise exception 'Lote inválido.' using errcode='22023';end if;
  if jsonb_array_length(p_events)>25 then raise exception 'Lote inválido.' using errcode='22023';end if;
  with bounded as (
   select * from jsonb_to_recordset(p_events) as e(id uuid,session_id uuid,occurred_at timestamptz,
    sequence integer,area text,event text,seconds smallint)
  )
  insert into neo_private.engagement_events(account,id,session_id,occurred_at,sequence,area,event,seconds)
  select u,id,session_id,occurred_at,sequence,area,event,coalesce(seconds,0) from bounded
   where id is not null and session_id is not null and sequence between 1 and 1000000
    and occurred_at between t-interval '10 minutes' and t+interval '30 seconds'
    and supported ? area and (
     event=any(string_to_array(supported->>area,' ')) or event='active_time'
     or (event=any(array['weight_record_started','weight_record_created','measurement_record_created','journal_record_created',
       'application_record_created','protocol_record_created','reminder_created']))
     or (event=any(array['before_after_open','photo_comparison_export_success','before_after_share_success']) and area in ('inicio','evolucao','fotos'))
    )
    and ((event='active_time' and seconds between 1 and 15) or (event<>'active_time' and coalesce(seconds,0)=0))
  on conflict(account,id) do nothing;
  get diagnostics accepted=row_count;
  delete from neo_private.engagement_events where (account,id) in (
   select account,id from neo_private.engagement_events where occurred_at < t-interval '90 days'
   order by occurred_at limit 250
  );
 elsif p_action is distinct from 'status' then raise exception 'Ação inválida.' using errcode='22023';
 end if;
 return jsonb_build_object('allowed',exists(select 1 from neo_private.audience_observations
  where user_id=u and engagement_expires_at>t and engagement_allowed),'accepted',accepted);
end $$;

create or replace function public.neo_admin_engagement(p_from date default null,p_to date default null,p_area text default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); today date:=(now() at time zone 'UTC')::date;
 start_day date:=coalesce(p_from,today-29); end_day date:=coalesce(p_to,today);
 start_at timestamptz; end_at timestamptz; prev_at timestamptz; result jsonb;
begin
 if u is null or not public.neo_admin_access() or not exists(select 1 from neo_private.admin_members where user_id=u) then
  raise exception 'Acesso de administrador obrigatório.' using errcode='42501';
 end if;
 if end_day<start_day or end_day>today or end_day-start_day>89 or length(p_area)>20 then raise exception 'Período inválido.' using errcode='22023';end if;
 start_at:=start_day::timestamp at time zone 'UTC';
 end_at:=(end_day+1)::timestamp at time zone 'UTC';
 prev_at:=start_at-(end_at-start_at);
 with eligible as materialized (
  select e.* from neo_private.engagement_events e join neo_private.audience_observations o on o.user_id=e.account
  where o.engagement_expires_at>now() and o.engagement_allowed and e.occurred_at>=now()-interval '90 days'
   and e.occurred_at>=prev_at and e.occurred_at<end_at
 ), period as materialized (select * from eligible where occurred_at>=start_at),
 per_session as (
  select account,session_id,sum(seconds) active,count(distinct area) areas,
   array_agg(event order by sequence,occurred_at,id) filter(where event<>'active_time') events
  from period group by account,session_id
 ), per_account as (
  select account,count(*) sessions from per_session group by account
 ), ranked as (
  select area,count(distinct account) users,count(distinct (account,session_id)) sessions,
   count(*) filter(where event like '%_view' and event not in ('product_list_view','product_detail_view','community_feed_view','community_members_view','community_library_view')) visits,
   sum(seconds) active,count(*) filter(where event ~ '(created|completed|success|sent|saved|^cart_add)$') completed
  from period group by area having count(distinct account)>=5
 ), previous as (
  select area,count(distinct account) users from eligible where occurred_at<start_at group by area having count(distinct account)>=5
 ), chosen as materialized (
  select * from period where area=p_area and exists(select 1 from ranked where area=p_area)
 ), days as (
  select (occurred_at at time zone 'UTC')::date as day,count(*) filter(where event like '%_view') n
  from chosen group by 1 having count(distinct account)>=5
 ), actions as (
  select event,count(*) n from chosen where event<>'active_time' group by 1 having count(distinct account)>=5
 ), cohort as (
  select distinct account from chosen
 ), dimensions as (
  select x.kind,x.label,count(*) n from cohort c join neo_private.audience_observations o on o.user_id=c.account
  cross join lateral(values ('Dispositivo',o.last_device->>'category'),('Sistema',o.last_device->>'os'),
   ('Navegador',o.last_device->>'browser'),('Modo',o.last_device->>'context'),
   ('Referência',o.first_campaign->>'referrer'),('Campanha',o.first_campaign->>'utm_campaign')) x(kind,label)
  where o.expires_at>now() and x.label is not null group by 1,2 having count(*)>=5
 ), area_repeat as (
  select account from chosen group by account having count(distinct session_id)>1
 ), funnels as (
  select v.name,v.steps from (values
   ('Evolução',array['evolution_view','weight_record_started','weight_record_created']),
   ('Fotografias',array['photos_view','photo_selected','photo_comparison_started','photo_comparison_export_success']),
   ('Loja',array['product_detail_view','cart_add','checkout_started','order_created'])
  ) v(name,steps)
 ), funnel_paths as (
  select f.name,f.steps,s.account,s.session_id,e1.pos first_step,e2.pos second_step,e3.pos third_step,e4.pos fourth_step
  from funnels f cross join per_session s
  cross join lateral (select array_position(s.events,f.steps[1]) pos) e1
  cross join lateral (select case when e1.pos is not null then array_position(s.events,f.steps[2],e1.pos+1) end pos) e2
  cross join lateral (select case when e2.pos is not null then array_position(s.events,f.steps[3],e2.pos+1) end pos) e3
  cross join lateral (select case when e3.pos is not null then array_position(s.events,f.steps[4],e3.pos+1) end pos) e4
  where e1.pos is not null
 ), funnel_counts as (
  select name,steps,array[count(*) filter(where first_step is not null),
   case when count(distinct account) filter(where second_step is not null)>=5 then count(*) filter(where second_step is not null) end,
   case when count(distinct account) filter(where third_step is not null)>=5 then count(*) filter(where third_step is not null) end,
   case when count(distinct account) filter(where fourth_step is not null)>=5 then count(*) filter(where fourth_step is not null) end] counts
  from funnel_paths group by name,steps having count(distinct account)>=5
 )
 select jsonb_build_object(
  'from',start_day,'to',end_day,
  'started_at',(select min(e.occurred_at) from neo_private.engagement_events e join neo_private.audience_observations o on o.user_id=e.account
   where o.engagement_expires_at>now() and o.engagement_allowed and e.occurred_at>=now()-interval '90 days'),
  'users',(select count(*) from per_account),'sessions',(select count(*) from per_session),
  'mean',(select round(avg(active)) from per_session),'median',(select round(percentile_cont(.5) within group(order by active)::numeric) from per_session),
  'areas',(select round(avg(areas),2) from per_session),
  'returning',(select case when count(*)>=5 then count(*) end from per_account where sessions>1),
  'ranking',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('previous_users',p.users) order by r.users desc,r.area),'[]') from ranked r left join previous p using(area)),
  'days',(select coalesce(jsonb_agg(to_jsonb(d) order by day),'[]') from days d),
  'actions',(select coalesce(jsonb_agg(to_jsonb(a) order by n desc,event),'[]') from actions a),
  'dimensions',(select coalesce(jsonb_agg(to_jsonb(d) order by kind,n desc,label),'[]') from dimensions d),
  'area_returning',(select case when count(*)>=5 then count(*) end from area_repeat),
  'funnels',(select coalesce(jsonb_agg(to_jsonb(f) order by name),'[]') from funnel_counts f)
 ) into result;
 return result;
end $$;

create or replace function public.neo_quality_observe(p_metric text,p_duration integer default null,p_revision text default '')
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); t timestamptz:=statement_timestamp();
begin
 if u is null then return false;end if;
 perform 1 from neo_private.audience_observations where user_id=u and engagement_allowed and engagement_expires_at>t for update;
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

create or replace function public.neo_admin_operations(p_section text,p_days int default 30,p_review jsonb default null)
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
   select q.*,case when o.expires_at>t then o.last_device end as last_device from neo_private.operations_quality q join neo_private.audience_observations o on o.user_id=q.account
   where q.bucket>=greatest(from_at,t-interval '90 days') and o.engagement_allowed and o.engagement_expires_at>t
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
    and e.occurred_at<=t and o.engagement_allowed and o.engagement_expires_at>t and e.occurred_at>=a.created_at and a.deleted_at is null
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

create or replace function public.neo_complete_onboarding(p_profile jsonb,p_settings jsonb,p_health boolean,p_terms boolean) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d jsonb;k text;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_health is distinct from true or p_terms is distinct from true then raise exception 'explicit consent required';end if;
 if not neo_private.take_limit('onboarding',12,3600) then raise exception 'too many requests';end if;
 if not public.neo_number(p_profile,'height',40,260) or not public.neo_number(p_profile,'initialWeight',1,650) or not public.neo_number(p_profile,'goal',1,650) then raise exception 'initial profile incomplete';end if;
 if jsonb_typeof(p_profile->'tracking') is distinct from 'object' then raise exception 'tracking preferences required';end if;
 foreach k in array array['weight','measures','journal','photos','applications'] loop
  if jsonb_typeof(p_profile->'tracking'->k) is distinct from 'boolean' then raise exception 'invalid tracking preference';end if;
 end loop;
 d=jsonb_build_object('profile',p_profile,'settings',p_settings);
 if public.neo_valid_profile(d) is distinct from true then raise exception 'invalid profile';end if;
 -- Presence of both core consents identifies accounts that already completed this flow.
 insert into neo_private.privacy_setup(user_id)
 select auth.uid()
 where not exists (select 1 from public.neo_consents c where c.user_id=auth.uid() and c.purpose in ('health','terms')
  group by c.user_id having count(distinct c.purpose)=2)
 on conflict(user_id) do nothing;
 insert into public.neo_consents(user_id,purpose,granted) values(auth.uid(),'health',true),(auth.uid(),'terms',true)
 on conflict(user_id,purpose,version) do update set granted=true,changed_at=now();
 insert into public.neo_profiles(user_id,data) values(auth.uid(),d) on conflict(user_id) do update set data=excluded.data;
end $$;


-- One authenticated transaction using the existing purpose-specific mechanisms.
create function public.neo_privacy_preferences(p_choices jsonb default null,p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Sessão obrigatória.' using errcode='42501'; end if;
 if p_choices is not null then
  if jsonb_typeof(p_choices)<>'object' then raise exception 'Preferências inválidas.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(p_choices) c
   where c.key not in ('statistics','usage','campaigns','location') or jsonb_typeof(c.value)<>'boolean') then
   raise exception 'Preferências inválidas.' using errcode='22023';
  end if;
  if p_choices ? 'statistics' then
   perform public.neo_audience_self(case when (p_choices->>'statistics')::boolean then 'allow' else 'remove' end);
  end if;
  if p_choices ? 'usage' then
   perform public.neo_engagement(case when (p_choices->>'usage')::boolean then 'enable' else 'disable' end);
  end if;
  if p_choices ? 'campaigns' then perform public.neo_campaign_push_preference((p_choices->>'campaigns')::boolean); end if;
  if p_choices ? 'location' then
   perform public.neo_geo_control(case when (p_choices->>'location')::boolean then 'allow' else 'remove' end);
  end if;
  insert into public.neo_consent_events(user_id,purpose,version,granted)
  select u,'optional_'||c.key,'2026-11-optional-v1',c.value::boolean from jsonb_each_text(p_choices) c;
 end if;
 if p_complete then
  update neo_private.privacy_setup set completed_at=statement_timestamp() where user_id=u and completed_at is null;
 end if;
 return jsonb_build_object(
  'pending',exists(select 1 from neo_private.privacy_setup where user_id=u and completed_at is null),
  'statistics',public.neo_audience_self('status')->'allowed',
  'usage',public.neo_engagement('status')->'allowed',
  'campaigns',public.neo_campaign_push_preference(),
  'location',public.neo_geo_control('status')->'allowed');
end $$;
revoke all on function public.neo_privacy_preferences(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.neo_privacy_preferences(jsonb,boolean) to authenticated;
commit;
