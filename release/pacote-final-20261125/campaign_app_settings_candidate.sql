-- After campaign_originals_candidate.sql. Structured App settings in draft; Teste keeps allowlist and never sends push.
begin;
set local lock_timeout='5s';
create function neo_private.campaign_app_settings_valid(s jsonb) returns boolean
language sql immutable security invoker set search_path='' as $valid$
 select case when jsonb_typeof(s) is distinct from 'object' then false else coalesce(
  (s-array['audience','targets','popup_enabled','push_requested','frequency_hours','max_views','priority','weekdays','opens_at','closes_at','ends_local'])='{}'::jsonb
  and s->>'audience' in ('all','plan','segment')
  and jsonb_typeof(s->'targets')='array'
  and case when jsonb_typeof(s->'targets')='array' then jsonb_array_length(s->'targets')<=20
    and (s->>'audience'='all' and jsonb_array_length(s->'targets')=0 or s->>'audience'<>'all' and jsonb_array_length(s->'targets')>=1)
    and not exists(select 1 from jsonb_array_elements(s->'targets') x where jsonb_typeof(x)<>'string'
     or (s->>'audience'='plan' and x#>>'{}' !~ '^[A-Za-z0-9_.-]{1,50}$')
     or (s->>'audience'='segment' and x#>>'{}' not in ('recent','established','community')))
    else false end
  and jsonb_typeof(s->'popup_enabled')='boolean' and jsonb_typeof(s->'push_requested')='boolean'
  and (s->'popup_enabled'='true'::jsonb or s->'push_requested'='true'::jsonb)
  and case when s->>'frequency_hours'~'^[0-9]{1,4}$' then (s->>'frequency_hours')::int between 1 and 8760 else false end
  and case when s->>'max_views'~'^[0-9]{1,3}$' then (s->>'max_views')::int between 1 and 100 else false end
  and case when s->>'priority'~'^[0-9]{1,3}$' then (s->>'priority')::int between 0 and 100 else false end
  and case when jsonb_typeof(s->'weekdays')='array' then jsonb_array_length(s->'weekdays') between 1 and 7
   and not exists(select 1 from jsonb_array_elements_text(s->'weekdays') d where d is null or d!~'^[0-6]$') else false end
  and s->>'opens_at'~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
  and s->>'closes_at'~'^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
  and s->>'opens_at'<s->>'closes_at'
  and (coalesce(s->>'ends_local','')='' or s->>'ends_local'~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'),false) end
$valid$;
revoke all on function neo_private.campaign_app_settings_valid(jsonb) from public,anon,authenticated;

do $patch$
declare definition text:=pg_get_functiondef('public.neo_campaign_editor_v1(text,jsonb)'::regprocedure);
 a constant text:=$a$  if (payload - array['title','blocks','groups','planned_local','timezone','audience'])<>'{}'$a$;
 b constant text:=$b$  if payload ? 'app_settings' and not neo_private.campaign_app_settings_valid(payload->'app_settings') then
    raise exception 'campaign_editor_invalid_app_settings' using errcode='22023';end if;
  if (payload - array['title','blocks','groups','planned_local','timezone','audience','app_settings'])<>'{}'$b$;
begin
 if cardinality(string_to_array(definition,a))<>2 then raise exception 'campaign_app_settings_unexpected_definition';end if;
 execute replace(definition,a,b);
end;$patch$;
-- Teste delivery: still uses only pre-approved accounts, no push and no external content.
alter table neo_private.campaign_test_batches add column app_settings jsonb;
alter table neo_private.campaign_test_batches add column ends_at timestamptz;
alter table neo_private.campaign_test_recipients add column display_count integer not null default 0 check(display_count between 0 and 100);
update neo_private.campaign_test_recipients set display_count=1 where displayed_at is not null;
create function neo_private.campaign_test_end(b neo_private.campaign_test_batches) returns timestamptz
language sql stable security invoker set search_path='' as $end$
 select coalesce(b.ends_at,b.starts_at+interval '24 hours')
$end$;
revoke all on function neo_private.campaign_test_end(neo_private.campaign_test_batches) from public,anon,authenticated;
create function neo_private.campaign_test_popup_eligible(b neo_private.campaign_test_batches,p_now timestamptz) returns boolean
language sql stable security invoker set search_path='' as $eligible$
 select b.cancelled_at is null and b.starts_at<=p_now and neo_private.campaign_test_end(b)>p_now
 and coalesce((b.app_settings->>'popup_enabled')::boolean,true)
 and coalesce(b.app_settings->'weekdays','[0,1,2,3,4,5,6]'::jsonb) @> jsonb_build_array(extract(dow from p_now at time zone 'America/Sao_Paulo')::int)
 and (p_now at time zone 'America/Sao_Paulo')::time>=coalesce((b.app_settings->>'opens_at')::time,'00:00'::time)
 and (p_now at time zone 'America/Sao_Paulo')::time<coalesce((b.app_settings->>'closes_at')::time,'24:00'::time)
$eligible$;
revoke all on function neo_private.campaign_test_popup_eligible(neo_private.campaign_test_batches,timestamptz) from public,anon,authenticated;
do $patch$
declare definition text:=pg_get_functiondef('public.neo_campaign_test_admin_v1(text,jsonb)'::regprocedure);
 a constant text:=$a$ body_text text;$a$;
 b constant text:=$b$ insert into neo_private.campaign_test_batches(id,owner_id,editor_id,revision,intent,title,body,starts_at)
 values(request_key,actor,editor,revision_number,p_data,version.draft->>'title',body_text,start_time);$b$;
begin
 if cardinality(string_to_array(definition,a))<>2 or cardinality(string_to_array(definition,b))<>2 then raise exception 'campaign_app_test_settings_unexpected_definition';end if;
 definition:=replace(definition,a,a||$a$
 settings jsonb;
 end_time timestamptz;$a$);
 definition:=replace(definition,b,$b$ settings:=version.draft->'app_settings';
 if settings is not null and (not neo_private.campaign_app_settings_valid(settings) or settings->'popup_enabled' is distinct from 'true'::jsonb) then
  raise exception 'campaign_test_popup_settings_required' using errcode='22023';end if;
 if nullif(settings->>'ends_local','') is not null then
  end_time:=neo_private.campaign_wall_time(settings->>'ends_local','America/Sao_Paulo');
  if end_time<=start_time or end_time>start_time+interval '90 days' then raise exception 'campaign_test_invalid_end' using errcode='22023';end if;
 end if;
 insert into neo_private.campaign_test_batches(id,owner_id,editor_id,revision,intent,title,body,starts_at,app_settings,ends_at)
 values(request_key,actor,editor,revision_number,p_data,version.draft->>'title',body_text,start_time,settings,end_time);$b$);
 definition:=replace(definition,'b.starts_at+interval ''24 hours''<=now()','neo_private.campaign_test_end(b)<=now()');
 execute definition;
end;$patch$;
do $patch$
declare definition text:=pg_get_functiondef('public.neo_campaign_test_visit_v1(text,uuid)'::regprocedure);
 a constant text:=$a$  where r.user_id=actor and b.cancelled_at is null and b.starts_at<=now()
   and b.starts_at+interval '24 hours'>now() and r.displayed_at is null
   and (r.offered_at is null or r.offered_at<=now()-interval '60 seconds')$a$;
 b constant text:=$b$  perform 1 from neo_private.campaign_test_batches where id=p_batch and cancelled_at is null
   and starts_at<=now() and starts_at+interval '24 hours'>now() for share;
  if not found then return 'false'::jsonb;end if;
  update neo_private.campaign_test_recipients set displayed_at=coalesce(displayed_at,now())
   where batch_id=p_batch and user_id=actor and offered_at is not null;$b$;
begin
 if cardinality(string_to_array(definition,a))<>2 or cardinality(string_to_array(definition,b))<>2 then raise exception 'campaign_app_visit_unexpected_definition';end if;
 definition:=replace(definition,a,$a$  where r.user_id=actor and neo_private.campaign_test_popup_eligible(b,now())
   and r.display_count<coalesce((b.app_settings->>'max_views')::int,1)
   and (r.displayed_at is null or r.displayed_at<=now()-make_interval(hours=>coalesce((b.app_settings->>'frequency_hours')::int,24)))
   and (r.offered_at is null or r.offered_at<=now()-interval '60 seconds')$a$);
 definition:=replace(definition,b,$b$  select * into batch from neo_private.campaign_test_batches b where b.id=p_batch and neo_private.campaign_test_popup_eligible(b,now()) for share;
  if not found then return 'false'::jsonb;end if;
  update neo_private.campaign_test_recipients set displayed_at=now(),display_count=display_count+1
   where batch_id=p_batch and user_id=actor and offered_at is not null and offered_at>now()-interval '5 minutes'
    and (displayed_at is null or offered_at>displayed_at)
    and display_count<coalesce((batch.app_settings->>'max_views')::int,1);$b$);
 execute definition;
end;$patch$;
do $patch$
declare definition text:=pg_get_functiondef('neo_private.campaign_app_central(text,jsonb)'::regprocedure);
begin
 definition:=replace(definition,'b.starts_at+interval ''24 hours''>now()','neo_private.campaign_test_end(b)>now()');
 definition:=replace(definition,'b.starts_at+interval ''24 hours''<=now()','neo_private.campaign_test_end(b)<=now()');
 execute definition;
end;$patch$;
commit;
