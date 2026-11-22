-- Run only on neopep-staging after the authenticated test deployment and device checks.
begin;
do $preflight$
begin
  if current_setting('app.settings.supabase_url', true) is distinct from 'https://qnuluspqfazdppciermw.supabase.co' then
    raise exception 'Confirme o alvo e disponibilize a URL de staging para o preflight.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name='neo_push_cron_secret' and length(decrypted_secret) between 32 and 256)
    or not exists (select 1 from vault.decrypted_secrets where name='neo_push_gateway_jwt' and decrypted_secret ~ '^eyJ') then
    raise exception 'Configure o segredo de push e o JWT anon de staging no Vault.';
  end if;
  if exists (select 1 from neo_private.push_devices) then
    raise exception 'Comece com zero inscrições e cadastre os dispositivos fictícios depois da ativação.';
  end if;
end
$preflight$;

create or replace function neo_private.support_push_wake() returns trigger language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare secret text; anon_jwt text;
begin
 if new.sender_id is null then return new;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='neo_push_cron_secret' limit 1;
 select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='neo_push_gateway_jwt' limit 1;
 if secret is not null and anon_jwt is not null then
  perform net.http_post(
   url:='https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch',
   headers:=jsonb_build_object('Content-Type','application/json','x-neo-cron-secret',secret,'Authorization','Bearer '||anon_jwt),
   body:='{"source":"message"}'::jsonb,
   timeout_milliseconds:=10000
  );
 end if;
 return new;
end $$;

create or replace function neo_private.push_dispatch_wake() returns void language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare secret text; anon_jwt text;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='neo_push_cron_secret' limit 1;
 select decrypted_secret into anon_jwt from vault.decrypted_secrets where name='neo_push_gateway_jwt' limit 1;
 if secret is not null and anon_jwt is not null then
  perform net.http_post(url:='https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch',headers:=jsonb_build_object('Content-Type','application/json','x-neo-cron-secret',secret,'Authorization','Bearer '||anon_jwt),body:='{"source":"event"}'::jsonb,timeout_milliseconds:=10000);
 end if;
end $$;

alter table neo_private.community_preferences drop constraint staging_community_push_disabled;
alter table neo_private.support_messages enable trigger neo_support_push_wake;
alter table neo_private.community_materials enable trigger neo_library_push_event;
alter table neo_private.shop_orders enable trigger neo_shop_push_event;
commit;
