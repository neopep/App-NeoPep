-- Candidate: run after the App central and cross-channel patches.
-- Creates an atomic series of dated App drafts. Existing reviewed schedule action activates them.
begin;
set local lock_timeout='5s';
create table neo_private.campaign_app_draft_series(
 owner_id uuid not null references auth.users(id), request_id uuid not null,
 campaign_id uuid not null references neo_private.campaign_app_groups(campaign_id),
 source_id uuid not null references neo_private.campaign_app_publications(id),
 source_revision integer not null, rule jsonb not null, occurrences jsonb not null,
 created_at timestamptz not null default now(), primary key(owner_id,request_id)
);
alter table neo_private.campaign_app_draft_series enable row level security;
revoke all on neo_private.campaign_app_draft_series from public,anon,authenticated;

create function neo_private.campaign_app_draft_dates(rule jsonb,clock_at timestamptz) returns jsonb
language plpgsql stable security invoker set search_path='' as $dates$
declare today date:=(clock_at at time zone 'America/Sao_Paulo')::date;
 first_day date; last_day date; max_count int; freq text; times jsonb; days jsonb; custom jsonb; result jsonb;
begin
 if jsonb_typeof(rule) is distinct from 'object' or (rule-array['start','end','frequency','times','count','days','day_times'])<>'{}'::jsonb
 or coalesce(rule->>'start','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or coalesce(rule->>'count','')!~'^[0-9]{1,2}$' then raise exception 'app_repeat_invalid_rule' using errcode='22023';end if;
 first_day:=(rule->>'start')::date;last_day:=coalesce(nullif(rule->>'end','')::date,today+89);
 max_count:=(rule->>'count')::int;freq:=rule->>'frequency';times:=rule->'times';days:=rule->'days';custom:=rule->'day_times';
 if freq is null or freq not in ('daily','weekly') or first_day<today or last_day>today+89 or last_day<first_day
 or max_count not between 1 and 24 or jsonb_typeof(times) is distinct from 'array' or jsonb_typeof(days) is distinct from 'array'
 then raise exception 'app_repeat_invalid_rule' using errcode='22023';end if;
 if jsonb_array_length(times) not between 1 and 8 or (freq='weekly' and jsonb_array_length(times)<>1)
 or exists(select 1 from jsonb_array_elements(times) x where jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
 or (select count(distinct x) from jsonb_array_elements(times) x)<>jsonb_array_length(times)
 or exists(select 1 from jsonb_array_elements(days) x where jsonb_typeof(x)<>'number' or x#>>'{}' !~ '^[0-6]$')
 or (select count(distinct x) from jsonb_array_elements(days) x)<>jsonb_array_length(days)
 or (freq='weekly' and jsonb_array_length(days) not between 1 and 7)
 then raise exception 'app_repeat_invalid_times' using errcode='22023';end if;
 if custom is not null then
  if freq<>'weekly' or jsonb_typeof(custom) is distinct from 'object' then raise exception 'app_repeat_invalid_custom' using errcode='22023';end if;
  if (select count(*) from jsonb_object_keys(custom))<>jsonb_array_length(days)
  or exists(select 1 from jsonb_each(custom) e where e.key !~ '^[0-6]$' or jsonb_typeof(e.value)<>'string' or e.value#>>'{}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  or exists(select 1 from jsonb_array_elements_text(days) d where not (custom ? d))
  then raise exception 'app_repeat_invalid_custom' using errcode='22023';end if;
 end if;
 select coalesce(jsonb_agg(q.at order by q.at),'[]'::jsonb) into result from(
  select to_char(first_day+i,'YYYY-MM-DD')||'T'||t as at from generate_series(0,last_day-first_day) i
  cross join lateral jsonb_array_elements_text(case when custom is null then times
   when custom ? extract(dow from first_day+i)::int::text then jsonb_build_array(custom->>extract(dow from first_day+i)::int::text) else '[]'::jsonb end) t
  where (freq='daily' or days @> jsonb_build_array(extract(dow from first_day+i)::int))
  and ((first_day+i)+t::time) at time zone 'America/Sao_Paulo'>clock_at
  order by at limit max_count) q;
 return result;
end;$dates$;
revoke all on function neo_private.campaign_app_draft_dates(jsonb,timestamptz) from public,anon,authenticated;

create function neo_private.campaign_app_draft_repeat(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $repeat$
declare actor uuid:=auth.uid(); cid uuid:=(p_data->>'campaign_id')::uuid; pid uuid:=(p_data->>'publication_id')::uuid;
 req uuid:=(p_data->>'request_id')::uuid; parent neo_private.campaign_app_groups;
 previous neo_private.campaign_app_draft_series; source neo_private.campaign_editor_versions;
 rule jsonb:=p_data->'rule'; dates jsonb; occurrences jsonb:='[]'::jsonb; wall text; item uuid; v jsonb;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then raise exception 'app_repeat_admin_required' using errcode='42501';end if;
 if p_action='repeat_capabilities' then return '{"enabled":true}'::jsonb;end if;
 select * into parent from neo_private.campaign_app_groups where campaign_id=cid and owner_id=actor and deleted_at is null for update;
 if not found then raise exception 'app_repeat_owner_required' using errcode='42501';end if;
 if p_action='repeat_list' then return coalesce((select jsonb_agg(jsonb_build_object('id',request_id,'publication_id',source_id,'rule',rule,'dates',(select jsonb_agg(x->>'date') from jsonb_array_elements(occurrences) x),'occurrences',occurrences) order by created_at desc) from neo_private.campaign_app_draft_series where owner_id=actor and campaign_id=cid),'[]'::jsonb);end if;
 if p_action<>'repeat_drafts' or parent.archived_at is not null or req is null or p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'app_repeat_confirmation_required' using errcode='22023';end if;
 select * into previous from neo_private.campaign_app_draft_series where owner_id=actor and request_id=req;
 if found then
  if row(previous.campaign_id,previous.source_id,previous.source_revision,previous.rule) is distinct from row(cid,pid,(p_data->>'source_revision')::int,rule) then raise exception 'app_repeat_request_conflict' using errcode='23505';end if;
  return jsonb_build_object('id',req,'occurrences',previous.occurrences,'reused',true);
 end if;
 select e.* into source from neo_private.campaign_app_publications p join neo_private.campaign_editor_versions e on e.editor_id=p.id and e.owner_id=actor and e.channel='app' where p.id=pid and p.campaign_id=cid and p.deleted_at is null order by e.revision desc limit 1;
 if not found or source.revision is distinct from (p_data->>'source_revision')::int then raise exception 'app_repeat_revision_changed' using errcode='40001';end if;
 dates:=neo_private.campaign_app_draft_dates(rule,now());
 if dates is distinct from p_data->'dates' or jsonb_array_length(dates)=0 then raise exception 'app_repeat_dates_changed' using errcode='22023';end if;
 if nullif(source.draft#>>'{app_settings,ends_local}','') is not null and exists(select 1 from jsonb_array_elements_text(dates) x where x>=source.draft#>>'{app_settings,ends_local}') then raise exception 'app_repeat_after_end' using errcode='22023';end if;
 for wall in select jsonb_array_elements_text(dates) loop
  item:=gen_random_uuid();
  v:=neo_private.campaign_app_central('save',jsonb_build_object('campaign_id',cid,'publication_id',item,'request_id',gen_random_uuid(),'revision',0,'draft',source.draft||jsonb_build_object('planned_local',wall)));
  if (v->>'revision')::int is distinct from 1 then raise exception 'app_repeat_save_failed';end if;
  occurrences:=occurrences||jsonb_build_array(jsonb_build_object('publication_id',item,'date',wall));
 end loop;
 insert into neo_private.campaign_app_draft_series(owner_id,request_id,campaign_id,source_id,source_revision,rule,occurrences) values(actor,req,cid,pid,source.revision,rule,occurrences);
 return jsonb_build_object('id',req,'occurrences',occurrences);
end;$repeat$;
revoke all on function neo_private.campaign_app_draft_repeat(text,jsonb) from public,anon,authenticated;
do $patch$
declare d text:=pg_get_functiondef('neo_private.campaign_app_central(text,jsonb)'::regprocedure);
 a constant text:=$a$ if p_action='list' then$a$;
begin
 if cardinality(string_to_array(d,a))<>2 then raise exception 'app_repeat_contract_changed';end if;
 execute replace(d,a,$a$ if p_action in ('repeat_capabilities','repeat_list','repeat_drafts') then
  return neo_private.campaign_app_draft_repeat(p_action,p_data);
 end if;
$a$||a);
end;$patch$;
commit;
