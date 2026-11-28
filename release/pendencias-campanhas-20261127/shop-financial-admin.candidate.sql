-- Financial permissions are stricter than the community integration admin role.
begin;
create function public.neo_shop_financial_admin_v1(p_actor uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null and exists(select 1 from neo_private.admin_members where user_id=p_actor)
$$;
revoke all on function public.neo_shop_financial_admin_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_financial_admin_v1(uuid) to service_role;
notify pgrst,'reload schema';
commit;
