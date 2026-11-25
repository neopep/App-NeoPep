begin read only;
select to_regclass('neo_private.campaign_editor_versions') is not null as editor,
 to_regprocedure('neo_private.campaign_admin_allowed()') is not null as admin_contract,
 to_regprocedure('neo_private.campaign_wall_time(text,text)') is not null as timezone_contract,
 to_regprocedure('public.neo_campaign_test_admin_v1(text,jsonb)') is null as migration_pending,
 (select bool_and(not app_enabled and not whatsapp_enabled) from neo_private.campaign_dispatch_config) as legacy_dispatch_off,
 (select bool_and(paused) from neo_private.connect_config) as connect_paused;
rollback;
