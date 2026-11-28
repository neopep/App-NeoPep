-- STAGING ONLY. Gate the Edge worker as well as its SQL scheduler.
begin;
create function public.neo_staging_push_dispatch_enabled_v1()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select coalesce((select enabled from neo_private.staging_push_dispatch_gate_v1 where singleton),false)
 and coalesce((select payment_environment='test' from neo_private.shop_settings where singleton),false)
$$;
revoke all on function public.neo_staging_push_dispatch_enabled_v1() from public,anon,authenticated,service_role;
grant execute on function public.neo_staging_push_dispatch_enabled_v1() to service_role;
notify pgrst,'reload schema';
commit;
