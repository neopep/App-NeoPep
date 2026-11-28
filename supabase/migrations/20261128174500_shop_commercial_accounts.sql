-- Optional commercial enrollment marker. It grants no shop, payment or app capability.
begin;

create table neo_private.shop_commercial_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enrolled_at timestamptz not null default now()
);
alter table neo_private.shop_commercial_accounts enable row level security;
revoke all on table neo_private.shop_commercial_accounts from public, anon, authenticated, service_role;

create function public.neo_commercial_account()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare actor uuid := auth.uid();
begin
 if actor is null then
  raise exception 'Autenticação obrigatória.' using errcode = '42501';
 end if;
 return jsonb_build_object(
  'id', actor,
  'commercialComplete', exists (
   select 1 from neo_private.shop_commercial_accounts where user_id = actor
  )
 );
end;
$$;

create function public.neo_manage_commercial_account(p_user uuid, p_enrolled boolean)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
 if auth.uid() is null or public.neo_admin_access() is not true then
  raise exception 'Autorização administrativa obrigatória.' using errcode = '42501';
 end if;
 if p_user is null or p_enrolled is null then
  raise exception 'Conta ou estado comercial inválido.' using errcode = '22023';
 end if;
 if p_enrolled then
  insert into neo_private.shop_commercial_accounts (user_id)
  values (p_user) on conflict (user_id) do nothing;
 else
  delete from neo_private.shop_commercial_accounts where user_id = p_user;
 end if;
end;
$$;

revoke all on function public.neo_commercial_account(),
 public.neo_manage_commercial_account(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.neo_commercial_account(),
 public.neo_manage_commercial_account(uuid, boolean) to authenticated;

commit;
