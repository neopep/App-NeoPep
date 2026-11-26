-- Apply after campaign_app_central_candidate.sql. Draft-only, no publication or schedule calls.
begin;
set local lock_timeout='5s';
alter table neo_private.campaign_channel_copies add column rule_snapshot jsonb not null default '[]'::jsonb;
create function neo_private.campaign_copy_channel(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $copy$
declare
 actor uuid:=auth.uid();
 source_key uuid:=(p_data->>'campaign_id')::uuid;
 request_key uuid:=(p_data->>'request_id')::uuid;
 source_kind text:=p_data->>'channel';
 target_kind text; target_key uuid; new_pub uuid; result jsonb; source_title text;
 prior neo_private.campaign_channel_copies; item record; copied integer:=0; total integer; rules jsonb:='[]'::jsonb;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(auth.jwt()->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then raise exception 'campaign_copy_admin_required' using errcode='42501';end if;
 if source_kind is null or source_kind not in ('app','whatsapp') or source_key is null or request_key is null
 or p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'campaign_copy_invalid_request' using errcode='22023';end if;
 target_kind:=case when source_kind='app' then 'whatsapp' else 'app' end;
 perform pg_advisory_xact_lock(hashtextextended('campaign-cross:'||actor::text||':'||request_key::text,0));
 select * into prior from neo_private.campaign_channel_copies x where x.owner_id=actor and x.request_id=request_key;
 if found then
  if row(prior.source_id,prior.source_channel) is distinct from row(source_key,source_kind) then raise exception 'campaign_copy_request_conflict' using errcode='23505';end if;
  return jsonb_build_object('campaign_id',prior.target_id,'channel',target_kind,'reused',true);
 end if;
 if source_kind='whatsapp' then
  perform 1 from neo_private.campaign_central_groups g where g.campaign_id=source_key and g.owner_id=actor and g.deleted_at is null for update;
  if not found then raise exception 'campaign_copy_owner_required' using errcode='42501';end if;
  select count(*) into total from neo_private.campaign_central_publications p where p.campaign_id=source_key and p.deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('publication_id',s.source_publication,'rule',s.rule-ARRAY['request_id','replace_id','confirmed','source_revision'],'state',s.state,
    'dates',(select coalesce(jsonb_agg(o.local_time order by o.local_time),'[]'::jsonb) from neo_private.campaign_weekly_occurrences o where o.series_id=s.id)) order by s.created_at),'[]'::jsonb)
   into rules from neo_private.campaign_weekly_series s where s.campaign_id=source_key and s.owner_id=actor and s.state<>'cancelled';
 else
  perform 1 from neo_private.campaign_app_groups g where g.campaign_id=source_key and g.owner_id=actor and g.deleted_at is null for update;
  if not found then raise exception 'campaign_copy_owner_required' using errcode='42501';end if;
  select count(*) into total from neo_private.campaign_app_publications p where p.campaign_id=source_key and p.deleted_at is null;
  select x.rule_snapshot into rules from neo_private.campaign_channel_copies x where x.target_id=source_key and x.owner_id=actor;
  rules:=coalesce(rules,'[]'::jsonb);
 end if;
 if total>100 then raise exception 'campaign_copy_too_many_publications' using errcode='22023';end if;
 select c.title into source_title from neo_private.campaigns c where c.id=source_key;
 -- Generate a new parent. No group, popup, push or dispatch is automatically activated.
 result:=public.neo_campaign_central_v1(case when target_kind='app' then 'app_create' else 'create' end,
  jsonb_build_object('title',source_title,'request_id',gen_random_uuid()));
 target_key:=(result->>'campaign_id')::uuid;
 for item in
  select p.id,v.draft from (
   select q.id,q.editor_id,q.created_at from neo_private.campaign_central_publications q where source_kind='whatsapp' and q.campaign_id=source_key and q.deleted_at is null
   union all select a.id,a.id,a.created_at from neo_private.campaign_app_publications a where source_kind='app' and a.campaign_id=source_key and a.deleted_at is null
  ) p join lateral(select ev.draft from neo_private.campaign_editor_versions ev where ev.editor_id=p.editor_id and ev.owner_id=actor and ev.channel=source_kind order by ev.revision desc limit 1)v on true order by p.created_at,p.id
 loop
  if exists(select 1 from jsonb_array_elements(item.draft->'blocks') b where b->>'type' in ('file','image') and nullif(b->>'media_path','') is null) then
   raise exception 'campaign_copy_original_media_unavailable' using errcode='22023';
  end if;
  new_pub:=gen_random_uuid();
  perform public.neo_campaign_central_v1(case when target_kind='app' then 'app_save' else 'save' end,
    jsonb_build_object('campaign_id',target_key,'publication_id',new_pub,'request_id',gen_random_uuid(),'revision',0,
     'draft',item.draft||jsonb_build_object('groups','[]'::jsonb,'audience',coalesce(item.draft->>'audience','all'))));
  copied:=copied+1;
 end loop;
 if copied<>total then raise exception 'campaign_copy_missing_revision' using errcode='40001';end if;
 insert into neo_private.campaign_channel_copies(owner_id,request_id,source_id,target_id,source_channel,rule_snapshot)
 values(actor,request_key,source_key,target_key,source_kind,rules);
 return jsonb_build_object('campaign_id',target_key,'channel',target_kind,'publications',copied,'recurrence_rules',jsonb_array_length(rules));
end;$copy$;
revoke all on function neo_private.campaign_copy_channel(jsonb) from public,anon,authenticated;

do $patch$
declare
 definition text:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 anchor constant text:=$a$ if left(p_action,4)='app_' then$a$;
 list_anchor constant text:=$b$select g.campaign_id,g.created_at,g.archived_at,c.title,$b$;
 detail_anchor constant text:=$c$'archived_at',parent.archived_at,'default_destination',parent.default_destination,$c$;
begin
 if cardinality(string_to_array(definition,anchor))<>2
 or cardinality(string_to_array(definition,list_anchor))<>2
 or cardinality(string_to_array(definition,detail_anchor))<>2 then raise exception 'campaign_copy_unexpected_definition';end if;
 definition:=replace(definition,anchor,$a$ if p_action='copy_channel' then
  return neo_private.campaign_copy_channel(p_data);
 end if;
$a$||anchor);
 definition:=replace(definition,list_anchor,list_anchor||$b$
    (select x.source_channel from neo_private.campaign_channel_copies x where x.target_id=g.campaign_id and x.owner_id=actor) origin_channel,$b$);
 definition:=replace(definition,detail_anchor,detail_anchor||$c$
   'origin_channel',(select x.source_channel from neo_private.campaign_channel_copies x where x.target_id=campaign_key and x.owner_id=actor),
   'copied_rules',coalesce((select x.rule_snapshot from neo_private.campaign_channel_copies x where x.target_id=campaign_key and x.owner_id=actor),'[]'::jsonb),$c$);
 execute definition;
end;$patch$;

do $patch$
declare definition text:=pg_get_functiondef('neo_private.campaign_app_central(text,jsonb)'::regprocedure);
 anchor constant text:=$a$'events','[]'::jsonb,'publications',$a$;
begin
 if cardinality(string_to_array(definition,anchor))<>2 then raise exception 'campaign_copy_app_unexpected_definition';end if;
 execute replace(definition,anchor,$a$'copied_rules',coalesce((select x.rule_snapshot from neo_private.campaign_channel_copies x where x.target_id=campaign_key and x.owner_id=actor),'[]'::jsonb),
   $a$||anchor);
end;$patch$;
commit;
