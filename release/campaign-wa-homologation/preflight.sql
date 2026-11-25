begin read only;
select to_regclass('neo_private.campaign_wa_test_config') is null as migration_pending,
 md5(pg_get_functiondef(to_regprocedure('public.neo_campaign_dispatch_admin_v1(text,jsonb)'))) as admin_fingerprint,
 md5(pg_get_functiondef(to_regprocedure('public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)'))) as device_fingerprint,
 (select bool_and(not whatsapp_enabled and not app_enabled) from neo_private.campaign_dispatch_config) as global_dispatch_off,
 (select bool_and(paused) from neo_private.connect_config) as connect_paused,
 (select count(*) from neo_private.connect_wa_connections c
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
  join neo_private.connect_wa_selected_groups g on g.connection_id=c.id
  where d.state='approved' and c.status='connected' and c.last_seen_at>now()-interval '90 seconds'
    and c.last_synced_at>now()-interval '24 hours') as recent_selected_destinations,
 (select count(*) from neo_private.campaign_dispatch_presence where session_ready and seen_at>now()-interval '90 seconds') as ready_presence,
 (select count(*) from neo_private.campaign_wa_publications where dispatch_state in ('waiting','leased','started')) as dispatch_pending;
rollback;
