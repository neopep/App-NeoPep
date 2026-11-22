-- Credenciais independentes para teste e producao, com ativacao explicita.
begin;
create table if not exists neo_private.shop_payment_environments(
 environment text primary key check(environment in ('test','production')),
 encrypted_access jsonb,
 encrypted_webhook jsonb,
 collector_id text,
 validated_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table neo_private.shop_payment_environments enable row level security;
revoke all on neo_private.shop_payment_environments from public,anon,authenticated;
insert into neo_private.shop_payment_environments(environment) values('test'),('production') on conflict do nothing;
insert into neo_private.shop_payment_environments(environment,encrypted_access,encrypted_webhook,collector_id,validated_at,updated_at)
select environment,encrypted_access,encrypted_webhook,collector_id,validated_at,updated_at from neo_private.shop_payment_integrations where singleton
on conflict(environment) do update set encrypted_access=coalesce(neo_private.shop_payment_environments.encrypted_access,excluded.encrypted_access),encrypted_webhook=coalesce(neo_private.shop_payment_environments.encrypted_webhook,excluded.encrypted_webhook),collector_id=coalesce(neo_private.shop_payment_environments.collector_id,excluded.collector_id),validated_at=coalesce(neo_private.shop_payment_environments.validated_at,excluded.validated_at);

create or replace function public.neo_shop_payment_integration(p_actor uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare env text:=coalesce(nullif(p_payload->>'environment',''),(select payment_environment from neo_private.shop_settings where singleton));i neo_private.shop_payment_environments;
begin
 perform public.neo_integration_admin(p_actor);
 if env not in ('test','production') then raise exception 'Ambiente inválido.';end if;
 if p_action='status' then
  return jsonb_build_object('active_environment',(select payment_environment from neo_private.shop_settings where singleton),'environments',coalesce((select jsonb_object_agg(environment,jsonb_build_object('configured',encrypted_access is not null and encrypted_webhook is not null,'collector_id',collector_id,'validated_at',validated_at)) from neo_private.shop_payment_environments),'{}'::jsonb),'webhook_url',current_setting('app.settings.supabase_url',true)||'/functions/v1/mercadopago-webhook');
 elsif p_action='save' then
  insert into neo_private.shop_payment_environments(environment,encrypted_access,encrypted_webhook,updated_at) values(env,p_payload->'encrypted_access',p_payload->'encrypted_webhook',now())
  on conflict(environment) do update set encrypted_access=coalesce(excluded.encrypted_access,shop_payment_environments.encrypted_access),encrypted_webhook=coalesce(excluded.encrypted_webhook,shop_payment_environments.encrypted_webhook),collector_id=null,validated_at=null,updated_at=now();
  update neo_private.shop_settings set payments_ready=false where singleton and payment_environment=env;return jsonb_build_object('ok',true,'environment',env);
 elsif p_action='validated' then
  update neo_private.shop_payment_environments set collector_id=p_payload->>'collector_id',validated_at=now(),updated_at=now() where environment=env returning * into i;
  if i.environment is null then raise exception 'Ambiente não configurado.';end if;
  update neo_private.shop_settings set payments_ready=true where singleton and payment_environment=env;return jsonb_build_object('ok',true,'environment',env);
 elsif p_action='activate' then
  select * into i from neo_private.shop_payment_environments where environment=env;
  if i.encrypted_access is null or i.encrypted_webhook is null or i.collector_id is null or i.validated_at is null then raise exception 'Valide este ambiente antes de ativar.';end if;
  update neo_private.shop_settings set payment_environment=env,payments_ready=true where singleton;return jsonb_build_object('ok',true,'active_environment',env);
 end if;
 raise exception 'Ação inválida.';
end$$;

create or replace function public.neo_shop_payment_credentials(p_environment text) returns jsonb language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('id','mercadopago','environment',environment,'encrypted_access',encrypted_access,'encrypted_webhook',encrypted_webhook,'collector_id',collector_id,'validated_at',validated_at) from neo_private.shop_payment_environments where environment=p_environment and p_environment in ('test','production')
$$;
create or replace function public.neo_shop_payment_credentials() returns jsonb language sql security definer set search_path=pg_catalog as $$
 select public.neo_shop_payment_credentials((select payment_environment from neo_private.shop_settings where singleton))
$$;
create or replace function public.neo_shop_payment_environment(p_order uuid) returns text language sql security definer set search_path=pg_catalog as $$select environment from neo_private.shop_orders where id=p_order$$;
revoke all on function public.neo_shop_payment_integration(uuid,text,jsonb),public.neo_shop_payment_credentials(text),public.neo_shop_payment_credentials(),public.neo_shop_payment_environment(uuid) from public,anon,authenticated;
grant execute on function public.neo_shop_payment_integration(uuid,text,jsonb),public.neo_shop_payment_credentials(text),public.neo_shop_payment_credentials(),public.neo_shop_payment_environment(uuid) to service_role;
commit;
