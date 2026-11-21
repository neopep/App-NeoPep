begin;
alter table neo_private.audience_observations add column engagement_allowed boolean not null default false;

create table neo_private.engagement_events (
 account uuid not null references neo_private.audience_observations(user_id) on delete cascade,
 id uuid not null,
 session_id uuid not null,
 occurred_at timestamptz not null,
 sequence integer not null,
 area text not null,
 event text not null,
 seconds smallint not null default 0,
 primary key(account,id)
);
create index engagement_events_time_idx on neo_private.engagement_events(occurred_at);
alter table neo_private.engagement_events enable row level security;
revoke all on neo_private.engagement_events from public,anon,authenticated;

create function public.neo_engagement(p_action text,p_events jsonb default '[]')
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
  update neo_private.audience_observations set engagement_allowed=true where user_id=u and expires_at>t;
 elsif p_action='disable' then
  update neo_private.audience_observations set engagement_allowed=false where user_id=u;
  delete from neo_private.engagement_events where account=u;
 elsif p_action='record' then
  -- Serialize consent revocation with ingestion for this account.
  perform 1 from neo_private.audience_observations where user_id=u and expires_at>t and engagement_allowed for update;
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
  where user_id=u and expires_at>t and engagement_allowed),'accepted',accepted);
end $$;

create function public.neo_admin_engagement(p_from date default null,p_to date default null,p_area text default null)
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
  where o.expires_at>now() and o.engagement_allowed and e.occurred_at>=now()-interval '90 days'
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
  where x.label is not null group by 1,2 having count(*)>=5
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
   where o.expires_at>now() and o.engagement_allowed and e.occurred_at>=now()-interval '90 days'),
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

revoke all on function public.neo_engagement(text,jsonb),public.neo_admin_engagement(date,date,text) from public,anon,authenticated;
grant execute on function public.neo_engagement(text,jsonb),public.neo_admin_engagement(date,date,text) to authenticated;
commit;
