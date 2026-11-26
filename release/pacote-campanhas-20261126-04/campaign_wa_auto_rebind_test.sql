-- Auto-rebind on an authenticated Connect heartbeat. Never migrate or dispatch queued messages.
begin;
set local lock_timeout='5s';
create function neo_private.campaign_wa_auto_rebind(p_actor uuid,p_device uuid,p_connection uuid) returns boolean
language plpgsql security invoker set search_path='pg_catalog' as $fn$
declare cfg neo_private.campaign_wa_test_config%rowtype;
begin
 if p_actor is null or auth.uid() is distinct from p_actor
 or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','') <> 'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then return false;end if;
 -- Fast path for ordinary heartbeat: no write or lock when the binding has not changed.
 if not exists(select 1 from neo_private.campaign_wa_test_config f where singleton and enabled and owner_id=p_actor and connection_id<>p_connection) then return false;end if;
 select * into cfg from neo_private.campaign_wa_test_config where singleton and enabled and owner_id=p_actor and connection_id<>p_connection for update skip locked;
 if not found or coalesce((select paused from neo_private.connect_config where singleton),true) then return false;end if;
 -- Explicit revocation only. A transient outage is not authority to change the sender.
 if not exists(select 1 from neo_private.connect_wa_connections old
  join neo_private.connect_wa_connections fresh on fresh.id=p_connection and fresh.created_at>old.created_at
  where old.id=cfg.connection_id and old.owner_id=p_actor and old.device_id=p_device and old.status='revoked'
   and fresh.owner_id=p_actor and fresh.device_id=p_device and fresh.status='connected') then return false;end if;
 if (select count(*) from neo_private.connect_wa_connections where owner_id=p_actor and status='connected')<>1 then return false;end if;
 if not exists(select 1 from neo_private.connect_wa_connections c
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
  join neo_private.campaign_dispatch_presence h on h.device_id=d.id and h.connection_id=c.id
  where c.id=p_connection and c.owner_id=p_actor and c.device_id=p_device and c.status='connected'
   and c.last_seen_at>now()-interval '90 seconds' and c.last_synced_at>now()-interval '24 hours'
   and c.revision>0 and d.state='approved' and d.version in ('0.2.13','0.2.14','0.2.15')
   and d.last_seen>now()-interval '90 seconds' and h.session_ready and h.bridge_version='wa-text-v1'
   and h.seen_at>now()-interval '90 seconds'
   and exists(select 1 from neo_private.connect_wa_selected_groups g where g.connection_id=c.id
    and g.group_jid=cfg.group_jid)) then return false;end if;
 -- No reassignment of destinations, reservations or batches. Fail closed while work is unresolved.
 if exists(select 1 from neo_private.campaign_wa_rich_messages where state in ('waiting','leased','started','uncertain'))
 or exists(select 1 from neo_private.campaign_wa_publications where dispatch_state in ('waiting','leased','started','uncertain'))
 or exists(select 1 from neo_private.campaign_manual_claims where state='reserved') then return false;end if;
 update neo_private.campaign_wa_test_config set connection_id=p_connection
 where singleton and enabled and owner_id=p_actor and connection_id=cfg.connection_id;
 if found then raise log 'NeoPep WhatsApp binding automatically updated (test)';return true;end if;
 return false;
end;$fn$;
revoke all on function neo_private.campaign_wa_auto_rebind(uuid,uuid,uuid) from public,anon,authenticated;
do $patch$
declare d text; a constant text:='session_ready=excluded.session_ready,seen_at=now();';
begin
 d:=pg_get_functiondef('public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)'::regprocedure);
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'wa_heartbeat_anchor_changed';end if;
 execute replace(d,a,a||E'\n  perform neo_private.campaign_wa_auto_rebind(actor,p_device,connection);');
end;$patch$;
commit;
