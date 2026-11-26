-- PRODUÇÃO candidate, separate from Teste. Read-only preflight against exact function fingerprints.
-- Do not apply until independent homologation, backup and release approval. Does NOT change existing dispatch gates.
begin;
set local lock_timeout='5s';
do $guard$ begin
 if md5(pg_get_functiondef('public.neo_campaign_dispatch_admin_v1(text,jsonb)'::regprocedure)) is distinct from '49f2db294f94aaf1e6c3955a93f89edb' then raise exception 'official_popup_contract_changed: neo_campaign_dispatch_admin_v1';end if;
 if md5(pg_get_functiondef('public.neo_campaign_editor_v1(text,jsonb)'::regprocedure)) is distinct from '083e8d654b6ed2d0690b6ea34ee72b4f' then raise exception 'official_popup_contract_changed: neo_campaign_editor_v1';end if;
 if md5(pg_get_functiondef('public.neo_campaign_image_allowed(text,boolean)'::regprocedure)) is distinct from '79c9ba362bb6d2d7bb359792c5aa02cf' then raise exception 'official_popup_contract_changed: neo_campaign_image_allowed';end if;
 if md5(pg_get_functiondef('public.neo_campaign_visit(text,uuid)'::regprocedure)) is distinct from '7aa9707890af40b2b22b643702871680' then raise exception 'official_popup_contract_changed: neo_campaign_visit';end if;
 if exists(select 1 from neo_private.campaign_dispatch_config where app_enabled) then raise exception 'official_app_gate_must_remain_disabled_during_migration';end if;
end $guard$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('neo-campaign-originals','neo-campaign-originals',false,5242880,array['application/pdf','video/mp4']);
create function public.neo_campaign_original_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $allow$
 select auth.uid() is not null and coalesce(neo_private.campaign_admin_allowed(),false)
 and coalesce(auth.jwt()->>'iss','')='https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1'
 and split_part(p_path,'/',1)=auth.uid()::text and p_path~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](pdf|mp4)$'
$allow$;
revoke all on function public.neo_campaign_original_allowed(text) from public,anon;
grant execute on function public.neo_campaign_original_allowed(text) to authenticated;
create policy campaign_original_read on storage.objects for select to authenticated using(bucket_id='neo-campaign-originals' and (select public.neo_campaign_original_allowed(name)));
create policy campaign_original_upload on storage.objects for insert to authenticated with check(bucket_id='neo-campaign-originals' and (select public.neo_campaign_original_allowed(name)));
create function neo_private.campaign_original_valid(p_owner uuid,p_block jsonb) returns boolean
language sql stable security invoker set search_path='' as $valid$
 select coalesce(
 p_owner is not null and p_block->>'type'='file' and jsonb_typeof(p_block->'name')='string'
 and length(btrim(p_block->>'name')) between 1 and 120
 and p_block->>'name' !~ '[[:cntrl:]/:*?"<>|]' and position(chr(92) in p_block->>'name')=0
 and split_part(p_block->>'media_path','/',1)=p_owner::text
 and p_block->>'media_path'~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](pdf|mp4)$'
 and ((lower(p_block->>'name') like '%.pdf' and p_block->>'media_path' like '%.pdf')
 or (lower(p_block->>'name') like '%.mp4' and p_block->>'media_path' like '%.mp4'))
 and exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=p_block->>'media_path'
 and o.metadata->>'mimetype'=case when p_block->>'media_path' like '%.pdf' then 'application/pdf' else 'video/mp4' end
 and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then (o.metadata->>'size')::int between 8 and 5242880 else false end),false)
$valid$;
revoke all on function neo_private.campaign_original_valid(uuid,jsonb) from public,anon,authenticated;
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
create function neo_private.campaign_popup_blocks(p_owner uuid,p_blocks jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $blocks$
declare b jsonb; k text; t text; path text; result jsonb:='[]'::jsonb; ref text; label text;
begin
 if jsonb_typeof(p_blocks) is distinct from 'array' then raise exception 'popup_blocks_invalid' using errcode='22023';end if;
 if jsonb_array_length(p_blocks) not between 1 and 12 then raise exception 'popup_blocks_limit' using errcode='22023';end if;
 for b in select value from jsonb_array_elements(p_blocks) loop
  k:=b->>'type';t:=coalesce(b->>'text','');path:=b->>'media_path';ref:=b->>'ref';
  if length(t)>2000 or t~*'(https?://|www[.]|/storage/v1/|[?&](token|signature|apikey)=)' then raise exception 'popup_text_invalid' using errcode='22023';end if;
  if k='text' then
   if length(btrim(t))=0 then raise exception 'popup_text_empty' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t));
  elsif k='image' then
   if path is null or split_part(path,'/',1)<>p_owner::text or path!~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$'
    or not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-images' and o.name=path
       and o.metadata->>'mimetype'='image/jpeg' and case when o.metadata->>'size'~'^[0-9]{1,9}$' then (o.metadata->>'size')::int between 4 and 1048576 else false end)
   then raise exception 'popup_image_unavailable' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'media_path',path));
  elsif k='file' then
   if not neo_private.campaign_original_valid(p_owner,b) then raise exception 'popup_file_unavailable' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'media_path',path,'name',b->>'name','mime',case when path like '%.pdf' then 'application/pdf' else 'video/mp4' end));
  elsif k='link' then
   if coalesce(b->>'url','')!~'^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$' or length(b->>'url')>1800
    or b->>'url'~*'/storage/v1/|[?&](token|signature|apikey|x-amz-[^=]*)=' then raise exception 'popup_link_invalid' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'url',b->>'url','label','Abrir link'));
  elsif k in ('product','document','community') then
   -- The destination applies its existing access rules; never reveal a private preview to a new audience.
   if coalesce(ref,'')!~'^[a-f0-9-]{36}$' then raise exception 'popup_reference_invalid' using errcode='22023';end if;
   if k='product' and not exists(select 1 from neo_private.shop_products p left join neo_private.shop_product_visibility v on v.product_id=p.id where p.id=ref::uuid and p.active and p.deleted_at is null and p.stock>0 and coalesce(v.mode,'public')='public') then raise exception 'popup_product_unavailable' using errcode='22023';end if;
   if k='document' and not exists(select 1 from neo_private.community_materials m where m.id=ref::uuid) then raise exception 'popup_document_unavailable' using errcode='22023';end if;
   if k='community' and not exists(select 1 from neo_private.community_posts p where p.id=ref::uuid and p.status='published') then raise exception 'popup_community_unavailable' using errcode='22023';end if;
   label:=case k when 'product' then 'Abrir produto' when 'document' then 'Abrir material na Biblioteca' else 'Abrir Comunidade' end;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'ref',ref,'label',label));
  else raise exception 'popup_block_unsupported' using errcode='22023';end if;
 end loop;
 return result;
end;$blocks$;
revoke all on function neo_private.campaign_popup_blocks(uuid,jsonb) from public,anon,authenticated;
alter table neo_private.campaigns add column rich_blocks jsonb;
create function neo_private.campaign_official_popup_media_allowed(p_path text,p_kind text) returns boolean
language sql stable security invoker set search_path='' as $media$
 select coalesce(auth.uid() is not null and public.neo_has_consent('terms') and exists(
  select 1 from neo_private.campaigns c join neo_private.campaign_impressions i on i.campaign_id=c.id
  cross join lateral jsonb_array_elements(c.rich_blocks) x
  where i.user_id=auth.uid() and i.reserved_at>now()-interval '5 minutes'
  and c.status='active' and c.popup_enabled and neo_private.campaign_matches(c,auth.uid(),now())
  and x->>'type'=p_kind and x->>'media_path'=p_path),false)
$media$;
revoke all on function neo_private.campaign_official_popup_media_allowed(text,text) from public,anon,authenticated;
create function public.neo_campaign_official_original_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $read$
 select neo_private.campaign_official_popup_media_allowed(p_path,'file')
$read$;
revoke all on function public.neo_campaign_official_original_read(text) from public,anon;
grant execute on function public.neo_campaign_official_original_read(text) to authenticated;
create policy campaign_official_original_read on storage.objects for select to authenticated using(bucket_id='neo-campaign-originals' and (select public.neo_campaign_official_original_read(name)));
CREATE OR REPLACE FUNCTION public.neo_campaign_dispatch_admin_v1(p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 actor uuid:=auth.uid();
 target uuid;
 key uuid;
 v neo_private.campaign_editor_versions;
 intent neo_private.campaign_dispatch_batch;
 config neo_private.campaign_dispatch_config;
 response jsonb;
 start_at timestamptz;
 occurrences integer;
 destination record;
 dest_count int;
 payload text;
 desired_revision int;
 audience_kind text;
 request_data jsonb;
 app_settings jsonb;
 rendered_blocks jsonb;
 app_end timestamptz;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then
  raise exception 'campaign_dispatch_admin_required' using errcode='42501';
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_payload' using errcode='22023'; end if;
 select * into strict config from neo_private.campaign_dispatch_config for share;
 if p_action='diagnostics' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen desc nulls last),'[]') into response from (
   select d.id,d.label,d.state,d.last_seen,d.version,p.bridge_version,c.status session_status,
     c.last_synced_at,
     (d.state='approved' and d.last_seen>now()-interval '90 seconds' and p.seen_at>now()-interval '90 seconds'
       and p.session_ready and c.status='connected' and c.last_seen_at>now()-interval '90 seconds'
       and c.last_synced_at>now()-interval '24 hours' and not (select paused from neo_private.connect_config)) is true as ready
   from neo_private.connect_devices d
   left join neo_private.campaign_dispatch_presence p on p.device_id=d.id
   left join neo_private.connect_wa_connections c on c.id=p.connection_id and c.device_id=d.id
   where d.owner_id=actor order by d.last_seen desc nulls last limit 30
  ) x;
  return jsonb_build_object('devices',response,'whatsapp_enabled',config.whatsapp_enabled,'app_enabled',config.app_enabled,'app_rich_popup',true);
 end if;
 if p_action='review' then
  select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') into response from (
   select distinct on (ev.editor_id) ev.campaign_id,ev.channel,ev.revision,ev.created_at,c.title,
     jsonb_array_length(ev.draft->'groups') as destinations,
     ev.draft->>'planned_local' as planned_local,ev.draft->>'timezone' as timezone,
     case when c.structured_review_only and exists(
       select 1 from neo_private.campaign_dispatch_batch b where b.editor_id=ev.editor_id)
       then 'tracking' when c.structured_review_only then 'blocked' else 'app' end as state
   from neo_private.campaign_editor_versions ev
   join neo_private.campaigns c on c.id=ev.campaign_id
   where ev.owner_id=actor
   order by ev.editor_id,ev.revision desc
  ) x;
  return response;
 end if;
 if p_action='app_status' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at desc),'[]') into response from (
   select b.id,c.title,c.status,c.starts_at,c.push_requested,b.cancelled_at
   from neo_private.campaign_dispatch_batch b
   join neo_private.campaign_editor_versions ev on ev.editor_id=b.editor_id and ev.revision=b.revision and ev.channel='app'
   join neo_private.campaigns c on c.id=ev.campaign_id
   where b.owner_id=actor and b.editor_id=(p_data->>'editor_id')::uuid
   order by c.starts_at desc limit 20
  ) x;
  return response;
 end if;
 if p_action='status' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at,x.id),'[]') into response from (
   select p.id,p.dispatch_batch,p.dispatch_jid,p.dispatch_state,p.dispatch_attempts,p.scheduled_at,
     p.dispatch_due,p.dispatch_cancel_requested,
     (select coalesce(jsonb_agg(to_jsonb(h) order by h.id desc),'[]') from (
       select a.id,a.event,a.receipt_id,a.recorded_at from neo_private.campaign_dispatch_audit a
       where a.publication_id=p.id order by a.id desc limit 25) h) as attempts
   from neo_private.campaign_wa_publications p
   join neo_private.campaign_dispatch_batch b on b.id=p.dispatch_batch and b.owner_id=actor
   where (p_data->>'batch_id' is null or b.id=(p_data->>'batch_id')::uuid)
     and (p_data->>'editor_id' is null or b.editor_id=(p_data->>'editor_id')::uuid)
   order by p.scheduled_at desc,p.id limit 180
  ) x;
  return response;
 end if;
 if p_action in ('cancel_app','reschedule_app') then
  key:=(p_data->>'batch_id')::uuid;
  select * into intent from neo_private.campaign_dispatch_batch b
   where b.id=key and b.owner_id=actor and b.manifest->>'action'='publish_app' for update;
  if not found then raise exception 'campaign_batch_unavailable' using errcode='42501'; end if;
  if p_action='cancel_app' and intent.cancelled_at is not null then return jsonb_build_object('ok',true); end if;
  select * into strict v from neo_private.campaign_editor_versions ev
   where ev.editor_id=intent.editor_id and ev.revision=intent.revision and ev.channel='app';
  if p_action='reschedule_app' then
   if not config.app_enabled then raise exception 'campaign_channel_disabled' using errcode='42501'; end if;
   start_at:=neo_private.campaign_wall_time(p_data->>'local_time','America/Sao_Paulo');
   if start_at is null or start_at<=now() or start_at>now()+interval '90 days' then
    raise exception 'campaign_schedule_invalid' using errcode='22023';
   end if;
  end if;
  update neo_private.campaigns c set updated_at=now(),
    status=case when p_action='cancel_app' then 'paused' else c.status end,
    starts_at=case when p_action='reschedule_app' then start_at else c.starts_at end
   where c.id=v.campaign_id and c.status='active' and c.starts_at>now();
  if not found then raise exception 'campaign_schedule_no_longer_editable' using errcode='40001'; end if;
  if p_action='cancel_app' then
   update neo_private.campaign_dispatch_batch set cancelled_at=now() where id=key;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action in ('cancel','reschedule') then
  key:=(p_data->>'batch_id')::uuid;
  perform 1 from neo_private.campaign_dispatch_batch b where b.id=key and b.owner_id=actor for update;
  if not found then raise exception 'campaign_batch_unavailable' using errcode='42501'; end if;
  if p_action='reschedule' then
   start_at:=neo_private.campaign_wall_time(p_data->>'local_time','America/Sao_Paulo');
   if start_at is null or start_at<=now() or start_at>now()+interval '90 days' then
    raise exception 'campaign_schedule_invalid' using errcode='22023';
   end if;
   -- Per occurrence. Active leases have to finish or expire before editing.
   update neo_private.campaign_wa_publications p set dispatch_due=start_at
     where p.dispatch_batch=key and p.id=(p_data->>'publication_id')::uuid and p.dispatch_state='waiting'
       and p.dispatch_due>now() returning p.id into target;
   if not found then raise exception 'campaign_schedule_no_longer_editable' using errcode='40001'; end if;
   insert into neo_private.campaign_dispatch_audit(publication_id,event,actor_id) values(target,'rescheduled',actor);
  else
   with cancelled as (
    update neo_private.campaign_wa_publications p set dispatch_cancel_requested=true,
      dispatch_state=case when dispatch_state='started' then 'started' else 'cancelled' end
    where p.dispatch_batch=key and dispatch_state in ('waiting','leased','started') and not dispatch_cancel_requested
    returning id,dispatch_state
   ) insert into neo_private.campaign_dispatch_audit(publication_id,event,actor_id)
     select id,case when dispatch_state='started' then 'cancel_requested' else 'cancelled' end,actor from cancelled;
  end if;
  return jsonb_build_object('ok',true);
 end if;

 if p_action is null or p_action not in ('schedule_whatsapp','publish_app') then
  raise exception 'campaign_action_unavailable' using errcode='22023';
 end if;
 target:=(p_data->>'editor_id')::uuid;
 key:=(p_data->>'request_id')::uuid;
 desired_revision:=(p_data->>'revision')::int;
 if target is null or key is null or desired_revision is null then raise exception 'campaign_ids_required' using errcode='22023'; end if;
 request_data:=p_data||jsonb_build_object('action',p_action);
 perform pg_advisory_xact_lock(hashtextextended('campaign-editor:'||target,0));
 select * into intent from neo_private.campaign_dispatch_batch b where b.id=key;
 if found then
  if intent.owner_id<>actor or intent.manifest<>request_data then raise exception 'campaign_request_conflict' using errcode='23505'; end if;
  return jsonb_build_object('batch_id',key);
 end if;
 select * into v from neo_private.campaign_editor_versions x
 where x.editor_id=target and x.owner_id=actor order by x.revision desc limit 1;
 if not found or v.revision<>desired_revision then raise exception 'campaign_revision_changed' using errcode='40001'; end if;
 if (p_action='schedule_whatsapp' and (not config.whatsapp_enabled or v.channel<>'whatsapp'))
    or (p_action='publish_app' and (not config.app_enabled or v.channel<>'app')) then
  raise exception 'campaign_channel_disabled' using errcode='42501';
 end if;
 if p_action='publish_app' then
  if p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'campaign_app_confirmation_required' using errcode='22023';end if;
  rendered_blocks:=neo_private.campaign_popup_blocks(actor,v.draft->'blocks');
  select left(coalesce(string_agg(x->>'text',E'\n\n'),''),2000) into payload from jsonb_array_elements(rendered_blocks) x;
  if btrim(payload)='' then payload:='Conteúdo da campanha';end if;
 else
 -- Only content with an end-to-end transport proof can enter the dispatch lane.
 if exists(select 1 from jsonb_array_elements(v.draft->'blocks') b where b->>'type'<>'text') then
  raise exception 'campaign_requires_text_only' using errcode='22023';
 end if;
 select btrim(string_agg(b->>'text',E'\n\n' order by pos)) into payload
 from jsonb_array_elements(v.draft->'blocks') with ordinality x(b,pos);
 if payload ~* '(https?://|www[.]|/storage/v1/|[?&](token|signature|apikey)=)' then
  raise exception 'campaign_links_require_revalidation' using errcode='22023';
 end if;
 if coalesce(length(payload),0) not between 1 and 2000 then raise exception 'campaign_text_limit' using errcode='22023'; end if;
 end if;
 start_at:=coalesce(neo_private.campaign_wall_time(p_data->>'local_time','America/Sao_Paulo'),now());
 if start_at<now()-interval '1 minute' or start_at>now()+interval '90 days' then raise exception 'campaign_schedule_invalid' using errcode='22023'; end if;
 occurrences:=coalesce((p_data->>'weekly_count')::int,1);
 if occurrences not between 1 and 6 then raise exception 'campaign_recurrence_limit' using errcode='22023'; end if;

 if p_action='publish_app' then
  if occurrences<>1 then raise exception 'campaign_app_recurrence_unavailable' using errcode='22023'; end if;
  audience_kind:=v.draft->>'audience';
  app_settings:=coalesce(v.draft->'app_settings',jsonb_build_object('audience',case when audience_kind='all' then 'all' else 'plan' end,
    'targets',case when audience_kind='all' then '[]'::jsonb else jsonb_build_array(audience_kind) end,
    'popup_enabled',true,'push_requested',coalesce((p_data->>'push')::boolean,false),'frequency_hours',24,'max_views',1,'priority',0,
    'weekdays','[0,1,2,3,4,5,6]'::jsonb,'opens_at','00:00','closes_at','24:00','ends_local',''));
  if not neo_private.campaign_app_settings_valid(app_settings) then raise exception 'campaign_app_settings_invalid' using errcode='22023';end if;
  app_end:=neo_private.campaign_wall_time(nullif(app_settings->>'ends_local',''),'America/Sao_Paulo');
  if app_end is not null and app_end<=start_at then raise exception 'campaign_app_end_invalid' using errcode='22023';end if;
  -- Keep the existing matching and push opt-in mechanism; only activate via existing disabled-by-default gate.
  update neo_private.campaigns set structured_review_only=false,status='active',title=v.draft->>'title',
    body=payload,rich_blocks=rendered_blocks,starts_at=start_at,ends_at=app_end,timezone='America/Sao_Paulo',
    audience=app_settings->>'audience',targets=array(select jsonb_array_elements_text(app_settings->'targets')),
    weekdays=array(select jsonb_array_elements_text(app_settings->'weekdays')::integer),
    opens_at=(app_settings->>'opens_at')::time,closes_at=(app_settings->>'closes_at')::time,
    frequency_hours=(app_settings->>'frequency_hours')::int,max_views=(app_settings->>'max_views')::int,priority=(app_settings->>'priority')::int,
    popup_enabled=(app_settings->>'popup_enabled')::boolean,push_requested=(app_settings->>'push_requested')::boolean,updated_at=now()
    where id=v.campaign_id and structured_review_only and status='draft';
  if not found then raise exception 'campaign_app_already_activated' using errcode='40001'; end if;
  insert into neo_private.campaign_dispatch_batch(id,owner_id,editor_id,revision,manifest) values(key,actor,target,v.revision,request_data);
  return jsonb_build_object('batch_id',key);
 end if;

 if exists(select 1 from neo_private.campaign_wa_publications p
   join neo_private.campaign_dispatch_batch b on b.id=p.dispatch_batch
   where b.editor_id=target and p.dispatch_state in ('waiting','leased','started')) then
   raise exception 'campaign_previous_schedule_pending' using errcode='40001';
 end if;
 dest_count:=jsonb_array_length(v.draft->'groups');
 if dest_count not between 1 and 30 or (select count(distinct split_part(g,':',2))
     from jsonb_array_elements_text(v.draft->'groups') g)<>dest_count then
  raise exception 'campaign_destination_limit' using errcode='22023';
 end if;
 insert into neo_private.campaign_dispatch_batch(id,owner_id,editor_id,revision,manifest) values(key,actor,target,v.revision,request_data);
 for destination in
  select split_part(g,':',1)::uuid connection_id,split_part(g,':',2) jid
  from jsonb_array_elements_text(v.draft->'groups') g
 loop
  if not exists(select 1 from neo_private.connect_wa_connections c
    join neo_private.connect_wa_selected_groups sg on sg.connection_id=c.id
    join neo_private.connect_devices d on d.id=c.device_id
    where c.id=destination.connection_id and sg.group_jid=destination.jid and c.owner_id=actor and d.state='approved') then
   raise exception 'campaign_destination_unavailable' using errcode='42501';
  end if;
  with created as (insert into neo_private.campaign_wa_publications(campaign_id,scheduled_at,timezone,status,
    dispatch_batch,dispatch_connection,dispatch_jid,dispatch_state,dispatch_due)
  select v.campaign_id, occurrence,'America/Sao_Paulo','cancelled',key,
    destination.connection_id,destination.jid,'waiting',occurrence
  from generate_series(0,occurrences-1) n
  cross join lateral (
    select ((start_at at time zone 'America/Sao_Paulo')+n*interval '7 days') at time zone 'America/Sao_Paulo' occurrence
  ) x returning id)
  insert into neo_private.campaign_dispatch_audit(publication_id,event,actor_id)
  select id,'scheduled',actor from created;
 end loop;
 return jsonb_build_object('batch_id',key);
end
$function$;

CREATE OR REPLACE FUNCTION public.neo_campaign_editor_v1(p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  actor uuid:=auth.uid();
  target uuid;
  source_campaign uuid;
  request_key uuid;
  channel_name text;
  payload jsonb;
  previous neo_private.campaign_editor_versions;
  saved neo_private.campaign_editor_versions;
  new_campaign jsonb;
  result jsonb;
  title text;
begin
  if not coalesce(neo_private.campaign_admin_allowed(),false) or actor is null then
    raise exception 'campaign_editor_admin_required' using errcode='42501';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'campaign_editor_invalid_payload' using errcode='22023';
  end if;

  if p_action='catalog' then
    select coalesce(jsonb_agg(to_jsonb(chosen) order by label,id),'[]') into result from (
      select p.id,p.name as label,p.price_cents
      from neo_private.shop_products p left join neo_private.shop_product_visibility v on v.product_id=p.id
      where p_data->>'kind'='product' and p.active and p.deleted_at is null and p.stock>0
        and coalesce(v.mode,'public')='public'
        and strpos(lower(p.name),lower(left(coalesce(p_data->>'search',''),100)))>0
      union all
      select m.id,m.title,null::int from neo_private.community_materials m
      where p_data->>'kind'='document' and strpos(lower(m.title),lower(left(coalesce(p_data->>'search',''),100)))>0
      union all
      select p.id,'Publicação · '||to_char(p.created_at at time zone 'America/Sao_Paulo','DD/MM/YYYY')||' · '||left(p.id::text,8),null::int
      from neo_private.community_posts p
      where p_data->>'kind'='community' and p.status='published'
        and strpos(p.id::text,lower(left(coalesce(p_data->>'search',''),36)))>0
      order by 2,1 limit 30
    ) chosen;
    return result;
  end if;

  if p_action='review' then
    select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc),'[]') into result from (
      select e.campaign_id,e.source_id,e.channel,e.revision,e.created_at,c.title,
        jsonb_array_length(e.draft->'groups') as destinations,'blocked'::text as state,
        e.draft->>'planned_local' as planned_local, e.draft->>'timezone' as timezone
      from neo_private.campaign_editor_versions e join neo_private.campaigns c on c.id=e.campaign_id
      where e.owner_id=actor and c.status='draft'
        and not exists(select 1 from neo_private.campaign_editor_versions newer
          where newer.editor_id=e.editor_id and newer.revision>e.revision)
      order by e.created_at desc limit 30
    ) v;
    return result;
  end if;

  if p_action='load' then
    select * into saved from neo_private.campaign_editor_versions
      where campaign_id=(p_data->>'campaign_id')::uuid and owner_id=actor
      order by revision desc limit 1;
    return case when found then to_jsonb(saved)-'owner_id'-'request_id' end;
  end if;
  if p_action is distinct from 'save' then
    raise exception 'campaign_editor_action_unavailable' using errcode='22023';
  end if;

  target:=(p_data->>'editor_id')::uuid;
  request_key:=(p_data->>'request_id')::uuid;
  source_campaign:=nullif(p_data->>'source_id','')::uuid;
  channel_name:=p_data->>'channel';
  payload:=p_data->'draft';
  title:=btrim(payload->>'title');
  if target is null or request_key is null or channel_name is null or channel_name not in ('app','whatsapp')
      or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>60000
      or coalesce(length(title),0) not between 1 and 120
      or jsonb_typeof(payload->'blocks') is distinct from 'array'
      or jsonb_typeof(payload->'groups') is distinct from 'array' then
    raise exception 'campaign_editor_invalid_draft' using errcode='22023';
  end if;
  if jsonb_array_length(payload->'blocks')>32 or jsonb_array_length(payload->'groups')>30
    or exists(select 1 from jsonb_array_elements(payload->'groups') g
      where jsonb_typeof(g)<>'string' or length(g#>>'{}')>200)
    or exists(select 1 from jsonb_array_elements(payload->'blocks') b
      where jsonb_typeof(b)<>'object' or coalesce(b->>'type','') not in ('text','image','file','link','product','document','community')
        or (b - array['id','type','text','label','ref','name','url','layout','media_path']) <> '{}'
        or (b->>'media_path' is not null and (
          split_part(b->>'media_path','/',1)<>actor::text or
          not (case when b->>'type'='file' then neo_private.campaign_original_valid(actor,b)
           when b->>'type' in ('image','document') then b->>'media_path' ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$'
           else false end)))
        or coalesce(length(b->>'text'),0)>4000
        or (b->>'url' is not null and (b->>'type'<>'link'
          or b->>'url' !~ '^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$'
          or b->>'url' ~* '/storage/v1/object/(sign|authenticated)/|[?&](token|signature|apikey|x-amz-[^=]*)='
          or length(b->>'url')>2000))) then
    raise exception 'campaign_editor_invalid_blocks' using errcode='22023';
  end if;
  if channel_name='app' and (jsonb_array_length(payload->'groups')<>0
     or coalesce(payload->>'audience','') not in ('all','free','premium')) then
    raise exception 'campaign_editor_invalid_app_audience' using errcode='22023';
  end if;
  if payload ? 'app_settings' and not neo_private.campaign_app_settings_valid(payload->'app_settings') then
    raise exception 'campaign_editor_invalid_app_settings' using errcode='22023';end if;
  if (payload - array['title','blocks','groups','planned_local','timezone','audience','app_settings'])<>'{}'
     or coalesce(payload->>'timezone','')<>'America/Sao_Paulo'
     or (nullif(payload->>'planned_local','') is not null
         and (payload->>'planned_local') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$') then
    raise exception 'campaign_editor_invalid_review' using errcode='22023';
  end if;
  if nullif(payload->>'planned_local','') is not null then
    perform neo_private.campaign_wall_time(payload->>'planned_local',payload->>'timezone');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('campaign-editor:'||target,0));
  select * into saved from neo_private.campaign_editor_versions where request_id=request_key;
  if found then
    if row(saved.owner_id,saved.editor_id,saved.channel,saved.source_id,saved.draft)
       is distinct from row(actor,target,channel_name,source_campaign,payload) then
      raise exception 'campaign_editor_request_conflict' using errcode='23505';
    end if;
    return to_jsonb(saved)-'owner_id'-'request_id';
  end if;
  select * into previous from neo_private.campaign_editor_versions where editor_id=target
    order by revision desc limit 1;
  if found and row(previous.owner_id,previous.channel,previous.source_id)
    is distinct from row(actor,channel_name,source_campaign) then
    raise exception 'campaign_editor_owner_required' using errcode='42501';
  end if;
  if coalesce(previous.revision,0) is distinct from (p_data->>'revision')::int then
    raise exception 'campaign_editor_revision_changed' using errcode='40001';
  end if;
  if previous.campaign_id is not null then
    perform 1 from neo_private.campaigns where id=previous.campaign_id and status='draft' for update;
    if not found then raise exception 'campaign_editor_existing_campaign_changed' using errcode='40001'; end if;
  end if;
  if source_campaign is not null and not exists(select 1 from neo_private.campaigns where id=source_campaign) then
    raise exception 'campaign_editor_source_missing' using errcode='22023';
  end if;

  if exists(select 1 from jsonb_array_elements(payload->'blocks') b where
    (b->>'type'='product' and not exists(select 1 from neo_private.shop_products p
       left join neo_private.shop_product_visibility v on v.product_id=p.id
       where p.id::text=b->>'ref' and p.active and p.deleted_at is null and p.stock>0 and coalesce(v.mode,'public')='public'))
    or (b->>'type'='document' and not exists(select 1 from neo_private.community_materials m where m.id::text=b->>'ref'))
    or (b->>'type'='community' and not exists(select 1 from neo_private.community_posts p where p.id::text=b->>'ref' and p.status='published'))) then
    raise exception 'campaign_editor_reference_unavailable' using errcode='22023';
  end if;

  -- A title-only shadow in the existing list. Do not set popup/push/activation,
  -- publication rows, Connect tasks, or reminders from this review endpoint.
  new_campaign:=public.neo_campaign_admin('save',previous.campaign_id,jsonb_build_object(
    'title',title,'body','','structured_review_only',true,'whatsapp_enabled',false,'popup_enabled',false,'push_requested',false));
  insert into neo_private.campaign_editor_versions(editor_id,revision,request_id,campaign_id,source_id,owner_id,channel,draft)
    values(target,coalesce(previous.revision,0)+1,request_key,(new_campaign->>'id')::uuid,source_campaign,actor,channel_name,payload)
    returning * into saved;
  return to_jsonb(saved)-'owner_id'-'request_id';
end
$function$;

CREATE OR REPLACE FUNCTION public.neo_campaign_image_allowed(p_path text, p_write boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select auth.uid() is not null and case when p_write then
  neo_private.campaign_admin_allowed() and split_part(p_path,'/',1)=auth.uid()::text
  and p_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
 else neo_private.campaign_admin_allowed() or neo_private.campaign_official_popup_media_allowed(p_path,'image') or (
  public.neo_has_consent('terms') and exists (
   select 1 from neo_private.campaigns c join neo_private.campaign_impressions i on i.campaign_id=c.id
   where c.image_path=p_path and c.status='active' and c.popup_enabled
    and i.user_id=auth.uid() and i.reserved_at>now()-interval '5 minutes'
  )
 ) end
$function$;

CREATE OR REPLACE FUNCTION public.neo_campaign_visit(p_action text, p_impression uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare account uuid:=auth.uid(); current_time_utc timestamptz:=now(); campaign neo_private.campaigns; receipt uuid;
begin
 if account is null then raise exception 'Sessão obrigatória.' using errcode='42501'; end if;
 if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=account) then return null; end if;
 if p_action='displayed' then
  update neo_private.campaign_impressions set displayed_at=coalesce(displayed_at,current_time_utc)
   where id=p_impression and user_id=account and reserved_at>current_time_utc-interval '5 minutes'
   and exists(select 1 from neo_private.campaigns where id=campaign_id and status='active');
  return to_jsonb(found);
 elsif p_action='clicked' then
  update neo_private.campaign_impressions set clicked_at=coalesce(clicked_at,current_time_utc)
   where id=p_impression and user_id=account and displayed_at>current_time_utc-interval '2 hours';
  return to_jsonb(found);
 elsif p_action<>'next' or p_action is null then
  raise exception 'Operação de campanha inválida.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('neo-campaign:'||account,0));
 if exists(select 1 from neo_private.campaign_impressions where user_id=account
  and reserved_at>current_time_utc-interval '5 minutes') then return null; end if;
 select c.* into campaign from neo_private.campaigns c
 where c.popup_enabled and neo_private.campaign_matches(c,account,current_time_utc)
  and (select count(*) from neo_private.campaign_impressions where user_id=account and campaign_id=c.id and displayed_at is not null)<c.max_views
  and not exists(select 1 from neo_private.campaign_impressions where user_id=account and campaign_id=c.id
   and displayed_at>current_time_utc-make_interval(hours=>c.frequency_hours))
 order by c.priority desc,c.updated_at desc,c.id limit 1;
 if not found then return null;end if;
 insert into neo_private.campaign_impressions(campaign_id,user_id) values(campaign.id,account) returning id into receipt;
 return jsonb_build_object('impression',receipt,'title',campaign.title,'body',campaign.body,'image_url',campaign.image_url,'image_path',campaign.image_path,
  'link_url',case when campaign.content_id is null then campaign.link_url else neo_private.campaign_destination(campaign.kind,campaign.content_id) end,'link_label',campaign.link_label,'kind',campaign.kind,'blocks',campaign.rich_blocks);
end $function$;
commit;
