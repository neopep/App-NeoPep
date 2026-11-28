-- STAGING ONLY: explicit administrator-approved account allowlist for sandbox checkout.
begin;
create table neo_private.staging_checkout_gate_v1(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into neo_private.staging_checkout_gate_v1(singleton) values(true);
create table neo_private.staging_checkout_users_v1(
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table neo_private.staging_checkout_gate_v1 enable row level security;
alter table neo_private.staging_checkout_users_v1 enable row level security;
revoke all on neo_private.staging_checkout_gate_v1,neo_private.staging_checkout_users_v1 from public,anon,authenticated,service_role;
create function public.neo_staging_checkout_allowed_v1(p_actor uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select p_actor is not null
 and coalesce((select enabled from neo_private.staging_checkout_gate_v1 where singleton),false)
 and coalesce((select payment_environment='test' and payments_ready from neo_private.shop_settings where singleton),false)
 and exists(select 1 from neo_private.staging_checkout_users_v1 where user_id=p_actor)
 and exists(select 1 from neo_private.shop_payment_environments where environment='test' and encrypted_access is not null and collector_id is not null and validated_at is not null)
$$;
revoke all on function public.neo_staging_checkout_allowed_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.neo_staging_checkout_allowed_v1(uuid) to service_role;
notify pgrst,'reload schema';
commit;
