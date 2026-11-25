begin read only;
do $$
begin
 if to_regprocedure('public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)') is not null
    or to_regclass('neo_private.campaign_dispatch_config') is not null then
  raise exception '013 dispatch already installed or partial';
 end if;
 if to_regclass('neo_private.campaign_editor_versions') is null
    or to_regclass('neo_private.campaign_wa_publications') is null
    or to_regclass('neo_private.connect_wa_selected_groups') is null
    or to_regclass('neo_private.connect_wa_connections') is null
    or to_regprocedure('public.neo_connect_wa_set_status(uuid,text,uuid,text)') is null then
  raise exception '013 dispatch prerequisites unavailable';
 end if;
end $$;
select conname,pg_get_constraintdef(oid) from pg_constraint
 where conrelid='neo_private.campaign_wa_publications'::regclass order by conname;
rollback;
