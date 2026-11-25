begin;
set local lock_timeout='5s';

create table neo_private.campaign_wa_test_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 schedule_enabled boolean not null default false check(not schedule_enabled or enabled),
 owner_id uuid references auth.users(id),
 connection_id uuid references neo_private.connect_wa_connections(id),
 group_jid text,
 check(not enabled or (owner_id is not null and connection_id is not null and group_jid ~ '^[0-9]+(-[0-9]+)?@g[.]us$'))
);
insert into neo_private.campaign_wa_test_config default values;
create table neo_private.campaign_wa_test_baseline (
 routine text primary key,
 definition text not null,
 patched_hash text
);
alter table neo_private.campaign_wa_test_config enable row level security;
alter table neo_private.campaign_wa_test_baseline enable row level security;
revoke all on neo_private.campaign_wa_test_config,neo_private.campaign_wa_test_baseline from public,anon,authenticated;

create function neo_private.campaign_wa_test_allowed(actor uuid, connection uuid, jid text default null)
returns boolean language sql stable set search_path=pg_catalog as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss'
  ='https://qnuluspqfazdppciermw.supabase.co/auth/v1',false)
 and exists(select 1 from neo_private.campaign_wa_test_config t
  join neo_private.connect_wa_connections c on c.id=t.connection_id and c.owner_id=t.owner_id
  join neo_private.connect_wa_selected_groups g on g.connection_id=c.id and g.group_jid=t.group_jid
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=t.owner_id
  where t.enabled and t.owner_id=actor and t.connection_id=connection
   and (jid is null or t.group_jid=jid) and d.state='approved');
$$;
revoke all on function neo_private.campaign_wa_test_allowed(uuid,uuid,text) from public,anon,authenticated;

create function neo_private.campaign_wa_test_ready(actor uuid, connection uuid, jid text)
returns boolean language sql stable set search_path=pg_catalog as $$
 select neo_private.campaign_wa_test_allowed(actor,connection,jid)
 and not coalesce((select paused from neo_private.connect_config),true)
 and exists(select 1 from neo_private.connect_wa_connections c
  join neo_private.connect_devices d on d.id=c.device_id
  join neo_private.campaign_dispatch_presence p on p.device_id=d.id and p.connection_id=c.id
  where c.id=connection and c.status='connected' and c.last_seen_at>now()-interval '90 seconds'
    and c.last_synced_at>now()-interval '24 hours' and d.last_seen>now()-interval '90 seconds'
    and p.session_ready and p.bridge_version='wa-text-v1' and p.seen_at>now()-interval '90 seconds');
$$;
revoke all on function neo_private.campaign_wa_test_ready(uuid,uuid,text) from public,anon,authenticated;

create function neo_private.campaign_wa_test_schedule(actor uuid, connection uuid, jid text)
returns boolean language sql stable set search_path=pg_catalog as $$
 select neo_private.campaign_wa_test_ready(actor,connection,jid)
 and exists(select 1 from neo_private.campaign_wa_test_config where schedule_enabled)
 and exists(select 1 from neo_private.campaign_wa_publications p
  join neo_private.campaign_dispatch_batch b on b.id=p.dispatch_batch
  join neo_private.campaign_dispatch_audit a on a.publication_id=p.id
  where b.owner_id=actor and b.manifest->'homologation'='true'::jsonb
   and nullif(b.manifest->>'local_time','') is null and p.dispatch_connection=connection and p.dispatch_jid=jid
   and p.dispatch_state='accepted' and a.event='accepted' and a.receipt_id is not null);
$$;
revoke all on function neo_private.campaign_wa_test_schedule(uuid,uuid,text) from public,anon,authenticated;

create unique index campaign_wa_test_revision on neo_private.campaign_dispatch_batch(editor_id,revision)
 where manifest->'homologation'='true'::jsonb;

-- Replace only reviewed anchors, in order. Refuse any upstream drift atomically.
create function neo_private.campaign_wa_test_patch(body text,anchor text,replacement text)
returns text language plpgsql set search_path=pg_catalog as $$
begin
 if body is null or (length(body)-length(replace(body,anchor,'')))<>length(anchor) then
  raise exception 'campaign_wa_test_contract_mismatch';
 end if;
 return replace(body,anchor,replacement);
end $$;
revoke all on function neo_private.campaign_wa_test_patch(text,text,text) from public,anon,authenticated;

do $patch$
declare
 admin_def text:=pg_get_functiondef(to_regprocedure('public.neo_campaign_dispatch_admin_v1(text,jsonb)'));
 device_def text:=pg_get_functiondef(to_regprocedure('public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)'));
begin
 insert into neo_private.campaign_wa_test_baseline(routine,definition) values('admin',admin_def),('device',device_def);
 admin_def:=neo_private.campaign_wa_test_patch(admin_def,
 $old$'whatsapp_enabled',config.whatsapp_enabled,'app_enabled',config.app_enabled$old$,
 $new$'whatsapp_enabled',false,'app_enabled',config.app_enabled,'whatsapp_test',(
  select jsonb_build_object('destination',t.connection_id::text||':'||t.group_jid,
    'ready',neo_private.campaign_wa_test_ready(actor,t.connection_id,t.group_jid),
    'schedule_ready',neo_private.campaign_wa_test_schedule(actor,t.connection_id,t.group_jid))
  from neo_private.campaign_wa_test_config t
  where neo_private.campaign_wa_test_allowed(actor,t.connection_id,t.group_jid))$new$);
 admin_def:=neo_private.campaign_wa_test_patch(admin_def,
 $old$(not config.whatsapp_enabled or v.channel<>'whatsapp')$old$,
 $new$(v.channel<>'whatsapp' or p_data->'homologation' is distinct from 'true'::jsonb
       or p_data->'confirmed' is distinct from 'true'::jsonb)$new$);
 admin_def:=neo_private.campaign_wa_test_patch(admin_def,
 $old$ if exists(select 1 from neo_private.campaign_wa_publications p
   join neo_private.campaign_dispatch_batch b on b.id=p.dispatch_batch$old$,
 $new$ if length(payload)>160 or occurrences<>1
   or payload ~* '(^|[^[:alnum:]_])([a-z0-9-]+[.])+[a-z]{2,}([^[:alnum:]_]|$)' then
  raise exception 'campaign_wa_test_single_short_message' using errcode='22023';
 end if;
 if not exists(select 1 from neo_private.campaign_wa_test_config t
   where v.draft->'groups'=jsonb_build_array(t.connection_id::text||':'||t.group_jid)
     and neo_private.campaign_wa_test_ready(actor,t.connection_id,t.group_jid)
     and (nullif(p_data->>'local_time','') is null
       or (start_at>now() and neo_private.campaign_wa_test_schedule(actor,t.connection_id,t.group_jid)))
   for share of t) then
  raise exception 'campaign_wa_test_destination_or_schedule_unavailable' using errcode='42501';
 end if;
 if exists(select 1 from neo_private.campaign_wa_publications p
   join neo_private.campaign_dispatch_batch b on b.id=p.dispatch_batch$new$);
 admin_def:=neo_private.campaign_wa_test_patch(admin_def,
 $old$   -- Per occurrence. Active leases have to finish or expire before editing.$old$,
 $new$   if exists(select 1 from neo_private.campaign_dispatch_batch
     where id=key and manifest->'homologation'='true'::jsonb) then
    raise exception 'campaign_wa_test_cancel_and_create_new_revision' using errcode='22023';
   end if;
   -- Per occurrence. Active leases have to finish or expire before editing.$new$);

 device_def:=neo_private.campaign_wa_test_patch(device_def,
 $old$(select whatsapp_enabled from neo_private.campaign_dispatch_config) and
           not coalesce((select paused from neo_private.connect_config),true)$old$,
 $new$neo_private.campaign_wa_test_ready(actor,connection,null)$new$);
 device_def:=neo_private.campaign_wa_test_patch(device_def,
 $old$(select whatsapp_enabled from neo_private.campaign_dispatch_config)
  and not (select paused from neo_private.connect_config)$old$,
 $new$neo_private.campaign_wa_test_ready(actor,presence.connection_id,null)$new$);
 device_def:=neo_private.campaign_wa_test_patch(device_def,
 $old$where dispatch_batch is not null and dispatch_state in ('leased','started')$old$,
 $new$where exists(select 1 from neo_private.campaign_dispatch_batch b
    where b.id=j.dispatch_batch and b.owner_id=actor and b.manifest->'homologation'='true'::jsonb)
    and dispatch_state in ('leased','started')$new$);
 device_def:=neo_private.campaign_wa_test_patch(device_def,
 $old$where j.dispatch_connection=presence.connection_id and j.dispatch_state='waiting'$old$,
 $new$where b.manifest->'homologation'='true'::jsonb
      and neo_private.campaign_wa_test_allowed(actor,j.dispatch_connection,j.dispatch_jid)
      and j.dispatch_connection=presence.connection_id and j.dispatch_state='waiting'$new$);
 device_def:=neo_private.campaign_wa_test_patch(device_def,
 $old$ if p_action='start' then
  if p.dispatch_state<>'leased'$old$,
 $new$ if p_action='start' then
  perform 1 from neo_private.connect_config where not paused for share;
  if not found then return null;end if;
  if p.dispatch_state<>'leased'$new$);
 device_def:=neo_private.campaign_wa_test_patch(device_def,
 $old$  if not ready or p.dispatch_connection<>presence.connection_id$old$,
 $new$  if not ready or p.dispatch_connection<>presence.connection_id
     or not exists(select 1 from neo_private.campaign_wa_test_config t
       join neo_private.campaign_dispatch_batch b on b.id=p.dispatch_batch
       where t.connection_id=p.dispatch_connection and t.group_jid=p.dispatch_jid
        and b.manifest->'homologation'='true'::jsonb
        and neo_private.campaign_wa_test_ready(actor,p.dispatch_connection,p.dispatch_jid) for share of t)$new$);
 execute admin_def;
 execute device_def;
 update neo_private.campaign_wa_test_baseline set patched_hash=md5(pg_get_functiondef(to_regprocedure(
   case routine when 'admin' then 'public.neo_campaign_dispatch_admin_v1(text,jsonb)'
    else 'public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)' end)));
end $patch$;

drop function neo_private.campaign_wa_test_patch(text,text,text);
notify pgrst,'reload schema';
commit;
