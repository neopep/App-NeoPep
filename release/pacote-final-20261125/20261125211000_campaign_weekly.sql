begin;
set local lock_timeout='5s';
create table neo_private.campaign_weekly_series (
 id uuid primary key,
 campaign_id uuid not null references neo_private.campaign_central_groups(campaign_id),
 source_publication uuid not null references neo_private.campaign_central_publications(id),
 owner_id uuid not null,
 rule jsonb not null,
 created_at timestamptz not null default now(),
 state text not null default 'scheduled' check(state in ('scheduled','paused','cancelled'))
);
create index campaign_weekly_series_owner on neo_private.campaign_weekly_series(owner_id,campaign_id);
create table neo_private.campaign_weekly_occurrences (
 series_id uuid not null references neo_private.campaign_weekly_series(id),
 publication_id uuid not null unique references neo_private.campaign_central_publications(id),
 batch_id uuid not null unique references neo_private.campaign_wa_rich_batches(id),
 local_time text not null,
 primary key(series_id,local_time)
);
alter table neo_private.campaign_weekly_series enable row level security;
alter table neo_private.campaign_weekly_occurrences enable row level security;
revoke all on neo_private.campaign_weekly_series,neo_private.campaign_weekly_occurrences from public,anon,authenticated,service_role;

create function public.neo_campaign_weekly_v1(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 campaign uuid:=(p_data->>'campaign_id')::uuid;
 request uuid:=(p_data->>'request_id')::uuid;
 source uuid:=(p_data->>'publication_id')::uuid;
 series neo_private.campaign_weekly_series;
 start_date date;
 end_date date;
 cutoff integer;
 wall text;
 dates text[];
 result jsonb;
 copy uuid;
 replace_id uuid:=(p_data->>'replace_id')::uuid;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then
  raise exception 'campaign_weekly_not_allowed' using errcode='42501';
 end if;
 perform 1 from neo_private.campaign_central_groups g where g.campaign_id=campaign and g.owner_id=actor for update;
 if not found then raise exception 'campaign_weekly_not_owned' using errcode='42501';end if;
 perform public.neo_campaign_central_v1('get',jsonb_build_object('campaign_id',campaign));
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'state',s.state,'publication_id',s.source_publication,
   'rule',s.rule,'dates',(select jsonb_agg(o.local_time order by o.local_time) from neo_private.campaign_weekly_occurrences o where o.series_id=s.id))
   order by s.created_at desc) from neo_private.campaign_weekly_series s where s.campaign_id=campaign and s.owner_id=actor),'[]'::jsonb);
 end if;
 if p_data->'confirmed' is distinct from 'true'::jsonb or request is null then
  raise exception 'campaign_weekly_confirmation_required' using errcode='22023';
 end if;
 select * into series from neo_private.campaign_weekly_series where id=request and owner_id=actor and campaign_id=campaign;
 if p_action in ('pause','cancel') then
  if series.id is null then raise exception 'campaign_weekly_unknown_series' using errcode='42501'; end if;
  if series.state='cancelled' or (series.state='paused' and p_action='pause') then return '{}'::jsonb; end if;
  -- Stop leased messages before the worker starts. A running send is allowed
  -- to finish and remains visible with its actual outcome.
  with cancelled as (
   update neo_private.campaign_wa_rich_messages m set state='cancelled',lease_until=null
   from neo_private.campaign_weekly_occurrences o
   where o.series_id=series.id and o.batch_id=m.batch_id and m.state in ('waiting','leased')
   returning m.id
  )
  insert into neo_private.campaign_wa_rich_audit(message_id,event) select id,'cancelled' from cancelled;
  update neo_private.campaign_weekly_series set state=case when p_action='pause' then 'paused' else 'cancelled' end where id=series.id;
  return '{}'::jsonb;
 end if;
 if p_action<>'schedule' then raise exception 'campaign_weekly_unknown_action' using errcode='22023'; end if;
 if series.id is not null then
  if series.rule<>p_data or series.source_publication<>source then
   raise exception 'campaign_weekly_request_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('id',series.id,'reused',true);
 end if;

 result:=public.neo_campaign_central_v1('load',jsonb_build_object('campaign_id',campaign,'publication_id',source));
 if (result->>'revision')::integer is distinct from (p_data->>'source_revision')::integer
 or coalesce((result->>'revision')::integer,0)<1 then
  raise exception 'campaign_weekly_source_changed' using errcode='40001';
 end if;
 start_date:=(p_data->>'start')::date;
 end_date:=coalesce(nullif(p_data->>'end','')::date,(now() at time zone 'America/Sao_Paulo')::date+89);
 cutoff:=coalesce(nullif(p_data->>'count','')::integer,24);
 if start_date is null or end_date<start_date or cutoff not between 1 and 24
 or start_date<(now() at time zone 'America/Sao_Paulo')::date
 or end_date>(now() at time zone 'America/Sao_Paulo')::date+89
 or coalesce(p_data->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
 or jsonb_typeof(p_data->'days') is distinct from 'array'
 or exists(select 1 from jsonb_array_elements_text(p_data->'days') d where d !~ '^[0-6]$')
 then raise exception 'campaign_weekly_invalid_rule' using errcode='22023';end if;
 select array_agg(p.at order by p.at) into dates from (
  select to_char(start_date+i,'YYYY-MM-DD')||'T'||(p_data->>'time') as at
  from generate_series(0,end_date-start_date) i
  where p_data->'days' @> jsonb_build_array(extract(dow from start_date+i)::integer)
    and ((start_date+i)+(p_data->>'time')::time) at time zone 'America/Sao_Paulo'>now()
  order by i limit cutoff
 ) p;
 if coalesce(cardinality(dates),0)=0 then raise exception 'campaign_weekly_no_dates' using errcode='22023';end if;
 -- The browser must confirm the exact occurrence list. A day that has
 -- elapsed since preview invalidates the request instead of moving a send.
 if p_data->'dates' is distinct from to_jsonb(dates) then
  raise exception 'campaign_weekly_review_changed' using errcode='22023';
 end if;
 if replace_id is not null then
  perform public.neo_campaign_weekly_v1('pause',jsonb_build_object('campaign_id',campaign,'request_id',replace_id,'confirmed',true));
  if exists(select 1 from neo_private.campaign_weekly_occurrences o
     join neo_private.campaign_wa_rich_messages m on m.batch_id=o.batch_id
     where o.series_id=replace_id and o.local_time=any(dates) and m.state in ('started','accepted','uncertain')) then
   raise exception 'campaign_weekly_occurrence_already_started' using errcode='55000';
  end if;
 end if;
 insert into neo_private.campaign_weekly_series(id,campaign_id,source_publication,owner_id,rule)
  values(request,campaign,source,actor,p_data);
 foreach wall in array dates loop
  copy:=gen_random_uuid();
  perform public.neo_campaign_central_v1('duplicate',jsonb_build_object('campaign_id',campaign,'publication_id',source,
    'request_id',copy,'planned_local',wall));
  result:=public.neo_campaign_central_v1('schedule',jsonb_build_object('campaign_id',campaign,'publication_id',copy,
    'request_id',gen_random_uuid(),'revision',1,'local_time',wall,'confirmed',true));
  insert into neo_private.campaign_weekly_occurrences values(request,copy,(result->>'batch_id')::uuid,wall);
 end loop;
 return jsonb_build_object('id',request,'dates',dates);
end;
$$;
revoke all on function public.neo_campaign_weekly_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_campaign_weekly_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
