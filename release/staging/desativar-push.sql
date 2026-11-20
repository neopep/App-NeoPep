-- Execute no neopep-staging. Suspenda primeiro o job de fallback, se instalado.
begin;
do $preflight$
begin
  if current_setting('app.settings.supabase_url', true) is distinct from 'https://qnuluspqfazdppciermw.supabase.co' then
    raise exception 'Confirme o alvo e disponibilize a URL de staging para o preflight.';
  end if;
end
$preflight$;
alter table neo_private.support_messages disable trigger neo_support_push_wake;
alter table neo_private.community_materials disable trigger neo_library_push_event;
alter table neo_private.shop_orders disable trigger neo_shop_push_event;
create or replace function neo_private.support_push_wake() returns trigger
language plpgsql security definer set search_path=pg_catalog,extensions as $$
begin
  return new;
end $$;
create or replace function neo_private.push_dispatch_wake() returns void
language plpgsql security definer set search_path=pg_catalog,extensions as $$
begin
  return;
end $$;
update neo_private.community_preferences set push_enabled=false where push_enabled;
alter table neo_private.community_preferences drop constraint if exists staging_community_push_disabled;
alter table neo_private.community_preferences add constraint staging_community_push_disabled check (not push_enabled);
commit;
