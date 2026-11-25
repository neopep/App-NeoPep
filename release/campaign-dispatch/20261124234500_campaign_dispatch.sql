begin;

create table neo_private.campaign_dispatch_config (
 singleton boolean primary key default true check(singleton),
 whatsapp_enabled boolean not null default false,
 app_enabled boolean not null default false
);
insert into neo_private.campaign_dispatch_config default values;

create table neo_private.campaign_dispatch_batch (
 id uuid primary key,
 owner_id uuid not null,
 editor_id uuid not null,
 revision int not null,
 manifest jsonb not null,
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 foreign key(editor_id,revision) references neo_private.campaign_editor_versions(editor_id,revision)
);
create table neo_private.campaign_dispatch_presence (
 device_id uuid primary key references neo_private.connect_devices(id) on delete cascade,
 connection_id uuid not null,
 bridge_version text not null,
 session_ready boolean not null,
 seen_at timestamptz not null default now()
);
alter table neo_private.campaign_wa_publications alter column group_id drop not null;
alter table neo_private.campaign_wa_publications
 add column dispatch_batch uuid references neo_private.campaign_dispatch_batch(id),
 add column dispatch_connection uuid,
 add column dispatch_jid text,
 add column dispatch_state text check(dispatch_state in ('waiting','leased','started','accepted','uncertain','failed','cancelled')),
 add column dispatch_attempts integer not null default 0,
 add column dispatch_due timestamptz,
 add column dispatch_fence uuid,
 add column dispatch_lease timestamptz,
 add column dispatch_device uuid,
 add column dispatch_cancel_requested boolean not null default false,
 add constraint campaign_dispatch_only_hidden check(dispatch_batch is null or
   (group_id is null and status='cancelled' and not remind and dispatch_connection is not null
    and dispatch_jid is not null and dispatch_state is not null and dispatch_due is not null));
create unique index campaign_dispatch_occurrence on neo_private.campaign_wa_publications
 (dispatch_batch,dispatch_jid,scheduled_at) where dispatch_batch is not null;
create index campaign_dispatch_due on neo_private.campaign_wa_publications
 (dispatch_connection,dispatch_due,id) where dispatch_state='waiting';
create table neo_private.campaign_dispatch_audit (
 id bigint generated always as identity primary key,
 publication_id uuid not null references neo_private.campaign_wa_publications(id),
 device_id uuid,
 fence uuid,
 event text not null,
 receipt_id text check(length(receipt_id)<=160),
 actor_id uuid,
 recorded_at timestamptz not null default clock_timestamp()
);
create index campaign_dispatch_audit_device on neo_private.campaign_dispatch_audit(device_id,recorded_at desc) where event='started';
do $$
declare name text;
begin
 foreach name in array array['campaign_dispatch_config','campaign_dispatch_batch','campaign_dispatch_presence','campaign_dispatch_audit'] loop
  execute format('alter table neo_private.%I enable row level security',name);
  execute format('revoke all on neo_private.%I from public,anon,authenticated,service_role',name);
 end loop;
end $$;

-- A general campaign editor may not edit a revision while a schedule is being
-- created. This checks the same advisory key used by the existing editor.
create function public.neo_campaign_dispatch_admin_v1(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
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
  return jsonb_build_object('devices',response,'whatsapp_enabled',config.whatsapp_enabled,'app_enabled',config.app_enabled);
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
 start_at:=coalesce(neo_private.campaign_wall_time(p_data->>'local_time','America/Sao_Paulo'),now());
 if start_at<now()-interval '1 minute' or start_at>now()+interval '90 days' then raise exception 'campaign_schedule_invalid' using errcode='22023'; end if;
 occurrences:=coalesce((p_data->>'weekly_count')::int,1);
 if occurrences not between 1 and 6 then raise exception 'campaign_recurrence_limit' using errcode='22023'; end if;

 if p_action='publish_app' then
  if occurrences<>1 then raise exception 'campaign_app_recurrence_unavailable' using errcode='22023'; end if;
  audience_kind:=v.draft->>'audience';
  -- One campaign record, with the established plan/opt-in mechanism.
  update neo_private.campaigns set structured_review_only=false,status='active',title=v.draft->>'title',
    body=payload,starts_at=start_at,timezone='America/Sao_Paulo',
    audience=case when audience_kind='all' then 'all' else 'plan' end,
    targets=case when audience_kind='all' then '{}' else array[audience_kind] end,
    popup_enabled=true,push_requested=coalesce((p_data->>'push')::boolean,false),updated_at=now()
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
$$;

create unique index campaign_dispatch_version_action on neo_private.campaign_dispatch_batch(editor_id,revision,(manifest->>'action'));

create function public.neo_campaign_dispatch_device_v1(p_action text,p_device uuid,p_secret text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 actor uuid:=auth.uid();
 c neo_private.connect_wa_connections;
 p neo_private.campaign_wa_publications;
 presence neo_private.campaign_dispatch_presence;
 selected uuid;
 connection uuid;
 payload text;
 outcome text;
 receipt text;
 ready boolean;
 fence uuid;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
    or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_data) is distinct from 'object' then
  raise exception 'campaign_device_unauthorized' using errcode='42501';
 end if;
 -- Serialize start/rhythm per device, including concurrent pollers.
 perform 1 from neo_private.connect_devices d where d.id=p_device and d.owner_id=actor
  and d.state='approved' and d.secret_hash=sha256(convert_to(p_secret,'UTF8')) for update;
 if not found then raise exception 'campaign_device_unauthorized' using errcode='42501'; end if;
 if p_action='heartbeat' then
  connection:=(p_data->>'connection_id')::uuid;
  select * into c from neo_private.connect_wa_connections where id=connection and device_id=p_device and owner_id=actor;
  if not found then raise exception 'campaign_connection_unauthorized' using errcode='42501'; end if;
  if coalesce(p_data->>'bridge_version','')<>'wa-text-v1' then
   raise exception 'campaign_bridge_unsupported' using errcode='22023';
  end if;
  insert into neo_private.campaign_dispatch_presence(device_id,connection_id,bridge_version,session_ready)
    values(p_device,connection,'wa-text-v1',coalesce((p_data->>'session_ready')::boolean,false))
  on conflict(device_id) do update set connection_id=excluded.connection_id,bridge_version=excluded.bridge_version,
    session_ready=excluded.session_ready,seen_at=now();
  return jsonb_build_object('capabilities',jsonb_build_array('text'),
    'enabled',(select whatsapp_enabled from neo_private.campaign_dispatch_config) and
           not coalesce((select paused from neo_private.connect_config),true));
 end if;
 if p_action is null or p_action not in ('claim','start','finish') then
  raise exception 'campaign_device_action_unavailable' using errcode='22023';
 end if;

 -- A lost lease before start is retryable. Once started, expiry is uncertain.
 -- Limit reaping per poll and skip locked rows to avoid blocking active workers.
 if p_action='claim' then
  with stale as (
   select j.id from neo_private.campaign_wa_publications j
   where dispatch_batch is not null and dispatch_state in ('leased','started') and dispatch_lease<=now()
   order by dispatch_lease limit 50 for update skip locked
  ), updated as (
   update neo_private.campaign_wa_publications j set dispatch_state=case when j.dispatch_state='started' then 'uncertain'
      when j.dispatch_cancel_requested then 'cancelled' else 'waiting' end
   from stale where j.id=stale.id returning j.id,j.dispatch_fence,j.dispatch_device,j.dispatch_state
  )
  insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event)
  select id,dispatch_device,dispatch_fence,case dispatch_state when 'waiting' then 'lease_expired' else dispatch_state end from updated;
 end if;

 select * into presence from neo_private.campaign_dispatch_presence where device_id=p_device;
 select * into c from neo_private.connect_wa_connections where id=presence.connection_id and device_id=p_device and owner_id=actor;
 ready:=(presence.seen_at>now()-interval '90 seconds' and presence.bridge_version='wa-text-v1'
  and presence.session_ready and c.status='connected' and c.last_seen_at>now()-interval '90 seconds'
  and c.last_synced_at>now()-interval '24 hours'
  and exists(select 1 from neo_private.connect_devices d where d.id=p_device and d.last_seen>now()-interval '90 seconds')
  and (select whatsapp_enabled from neo_private.campaign_dispatch_config)
  and not (select paused from neo_private.connect_config)) is true;

 if p_action='claim' then
  if not ready or exists(select 1 from neo_private.campaign_dispatch_audit a where a.device_id=p_device
       and a.event='started' and a.recorded_at>now()-interval '10 seconds')
      or exists(select 1 from neo_private.campaign_wa_publications j
    where j.dispatch_device=p_device and j.dispatch_state in ('leased','started') and j.dispatch_lease>now()) then return null; end if;
  select j.id into selected from neo_private.campaign_wa_publications j
    join neo_private.campaign_dispatch_batch b on b.id=j.dispatch_batch and b.owner_id=actor
    where j.dispatch_connection=presence.connection_id and j.dispatch_state='waiting'
      and not j.dispatch_cancel_requested and j.dispatch_due<=now()
    order by j.dispatch_due,j.id limit 1 for update of j skip locked;
  if not found then return null; end if;
  update neo_private.campaign_wa_publications set dispatch_state='leased',dispatch_device=p_device,
    dispatch_fence=gen_random_uuid(),dispatch_lease=now()+interval '30 seconds'
    where id=selected returning * into p;
  insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id)
    values(p.id,p_device,p.dispatch_fence,'leased',actor);
  return jsonb_build_object('id',p.id,'fence',p.dispatch_fence);
 end if;

 selected:=(p_data->>'id')::uuid;
 fence:=(p_data->>'fence')::uuid;
 select * into p from neo_private.campaign_wa_publications j
 where j.id=selected and j.dispatch_device=p_device and j.dispatch_fence=fence and j.dispatch_batch is not null
 for update;
 if not found then raise exception 'campaign_lease_unauthorized' using errcode='42501'; end if;

 if p_action='start' then
  if p.dispatch_state<>'leased' or p.dispatch_lease<=now() or p.dispatch_cancel_requested then return null; end if;
  if not ready or p.dispatch_connection<>presence.connection_id
     or exists(select 1 from neo_private.campaign_dispatch_audit a where a.device_id=p_device
       and a.event='started' and a.recorded_at>now()-interval '10 seconds') then return null; end if;
  if not exists(select 1 from neo_private.connect_wa_selected_groups g
   where g.connection_id=p.dispatch_connection and g.group_jid=p.dispatch_jid) then
   update neo_private.campaign_wa_publications set dispatch_state='failed' where id=p.id;
   insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id)
    values(p.id,p_device,p.dispatch_fence,'destination_revoked',actor);
   return null;
  end if;
  -- A synchronized group may appear on more than one authorized device.
  perform pg_advisory_xact_lock(hashtextextended('campaign-group:'||p.dispatch_jid,0));
  if exists(select 1 from neo_private.campaign_dispatch_audit a
    join neo_private.campaign_wa_publications prior on prior.id=a.publication_id
    where prior.dispatch_jid=p.dispatch_jid and a.event='started' and a.recorded_at>now()-interval '30 seconds') then
   return null;
  end if;
  select btrim(string_agg(x.block->>'text',E'\n\n' order by x.pos)) into payload
   from neo_private.campaign_dispatch_batch b join neo_private.campaign_editor_versions v
    on v.editor_id=b.editor_id and v.revision=b.revision
   cross join lateral jsonb_array_elements(v.draft->'blocks') with ordinality x(block,pos)
   where b.id=p.dispatch_batch;
  update neo_private.campaign_wa_publications set dispatch_state='started',dispatch_attempts=dispatch_attempts+1,
    dispatch_lease=now()+interval '60 seconds' where id=p.id;
  insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id)
   values(p.id,p_device,p.dispatch_fence,'started',actor);
  return jsonb_build_object('id',p.id,'fence',p.dispatch_fence,'group_jid',p.dispatch_jid,'text',payload);
 end if;

 outcome:=p_data->>'outcome';
 if outcome is null or outcome not in ('accepted','uncertain','refused') then
  raise exception 'campaign_invalid_outcome' using errcode='22023';
 end if;
 if p.dispatch_state<>'started' or p.dispatch_lease<=now() then return null; end if;
 receipt:=nullif(btrim(p_data->>'receipt_id'),'');
 if outcome='accepted' and (receipt is null or length(receipt)>160) then outcome:='uncertain'; end if;
 update neo_private.campaign_wa_publications set dispatch_state=case
   when outcome='refused' and p.dispatch_cancel_requested then 'cancelled'
   when outcome='refused' and p.dispatch_attempts<3 then 'waiting'
   when outcome='refused' then 'failed' else outcome end,
   dispatch_due=case when outcome='refused' then now()+p.dispatch_attempts*interval '2 minutes' else dispatch_due end
 where id=p.id returning * into p;
 insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id,receipt_id)
   values(p.id,p_device,p.dispatch_fence,outcome,actor,case when outcome='accepted' then receipt end);
 return jsonb_build_object('state',p.dispatch_state);
end
$$;

revoke all on function public.neo_campaign_dispatch_admin_v1(text,jsonb),
 public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_campaign_dispatch_admin_v1(text,jsonb),
 public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
