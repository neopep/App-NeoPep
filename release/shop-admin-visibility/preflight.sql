-- Read-only. Run separately against each authenticated database connection.
begin read only;
select current_database() as database_name,
       md5(btrim(p.prosrc,E'\n\r\t ')) as body_hash,
       position('shop_store_hidden' in p.prosrc)>0 as storefront_marker,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute
from pg_proc p
where p.oid=to_regprocedure('public.neo_shop(text,jsonb)');

select version,name from supabase_migrations.schema_migrations
where name in ('shop_member_visibility_20261123','shop_store_admin_visibility_20261123')
   or version in ('20261123203830','20261123220000','20261123234500')
order by version;

select to_regprocedure('neo_private.shop_before_member_visibility(text,jsonb)') as preserved_api,
       to_regprocedure('neo_private.shop_product_blocked(uuid,uuid)') as member_policy,
       to_regprocedure('public.neo_shop_photo(text,boolean)') as gallery_policy,
       to_regprocedure('public.neo_campaign_wa_sync(text,uuid,jsonb)') as campaign_sync,
       to_regclass('neo_private.campaign_wa_sync_targets') as campaign_targets,
       to_regclass('neo_private.campaign_wa_recipients') as campaign_recipients;

select id,public from storage.buckets where id='neo-shop-products';
select pubname,schemaname,tablename from pg_publication_tables
where pubname='supabase_realtime' and tablename in ('neo_message_events','neo_shop_visibility_events');
rollback;
