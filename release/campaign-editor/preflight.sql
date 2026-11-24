begin read only;
do $$
begin
 if to_regprocedure('public.neo_campaign_editor_v1(text,jsonb)') is not null
    or to_regclass('neo_private.campaign_editor_versions') is not null
    or exists(select 1 from pg_attribute where attrelid=to_regclass('neo_private.campaigns')
       and attname='structured_review_only' and not attisdropped)
 then raise exception '013 structured review already present or partial'; end if;
 if to_regprocedure('public.neo_campaign_admin(text,uuid,jsonb)') is null
    or to_regprocedure('public.neo_campaign_wa(text,uuid,jsonb)') is null
    or to_regprocedure('neo_private.campaign_admin_allowed()') is null
    or to_regclass('neo_private.shop_product_visibility') is null then
  raise exception '013 dependency absent';
 end if;
end $$;
select to_regprocedure('public.neo_campaign_wa_sync(text,uuid,jsonb)') as installed_group_catalog;
commit;
