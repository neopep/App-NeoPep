-- STAGING ONLY. Provision independent Teste VAPID keys and NEO_PUSH_CRON_SECRET in Edge Functions.
-- Vault neo_push_cron_secret must match that secret; neo_push_gateway_jwt must be
-- a JWT accepted by the Teste gateway (legacy anon key), never a production key.
-- No outbound traffic until the explicit gate and cron job are both enabled.
begin;
do $$ begin
 if (select payment_environment from neo_private.shop_settings where singleton) is distinct from 'test'
 or to_regprocedure('neo_private.push_dispatch_wake()') is null
 or (select regexp_replace(prosrc,'\s','','g') not in ('beginreturn;end;','beginreturn;end','selectnull;','selectnull') from pg_proc where oid='neo_private.push_dispatch_wake()'::regprocedure)
 then raise exception 'staging_push_preflight_failed';end if;
end $$;
create table neo_private.staging_push_dispatch_gate_v1(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 last_requested_at timestamptz
);
insert into neo_private.staging_push_dispatch_gate_v1(singleton) values(true);
alter table neo_private.staging_push_dispatch_gate_v1 enable row level security;
revoke all on neo_private.staging_push_dispatch_gate_v1 from public,anon,authenticated,service_role;
create or replace function neo_private.push_dispatch_wake()
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare secret text; gateway text;
begin
 if not exists(select 1 from neo_private.staging_push_dispatch_gate_v1 where singleton and enabled) then return;end if;
 if (select payment_environment from neo_private.shop_settings where singleton) is distinct from 'test' then return;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='neo_push_cron_secret';
 select decrypted_secret into gateway from vault.decrypted_secrets where name='neo_push_gateway_jwt';
 if length(coalesce(secret,''))<32 or length(coalesce(secret,''))>256 or coalesce(gateway,'') !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then return;end if;
 update neo_private.staging_push_dispatch_gate_v1 set last_requested_at=clock_timestamp()
 where singleton and enabled and (last_requested_at is null or last_requested_at<=clock_timestamp()-interval '15 seconds');
 if not found then return;end if;
 perform net.http_post(url:='https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway,'x-neo-cron-secret',secret),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function neo_private.push_dispatch_wake() from public,anon,authenticated,service_role;
select cron.alter_job(cron.schedule('neo-push-dispatch-staging-v1','* * * * *','select neo_private.push_dispatch_wake()'),active:=false);
commit;
