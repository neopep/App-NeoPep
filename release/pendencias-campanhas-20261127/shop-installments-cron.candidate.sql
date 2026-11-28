-- Candidate only. Run after independently deploying and testing the installment worker.
-- Before enabling: provision the SAME strong random secret in Edge Function environment
-- NEO_INSTALLMENT_CRON_SECRET and Supabase Vault named neo_installment_cron_secret.
-- Do not store that secret in Git or logs. pg_cron prerequisite. This candidate is pinned to the test project and registers the job inactive.
begin;
create function neo_private.shop_installment_schedule_v1()
returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare cfg neo_private.shop_installment_config_v1; h int; endpoint text; secret text; request_id bigint;
begin
 select c.* into cfg from neo_private.shop_installment_config_v1 c join neo_private.shop_settings s on s.payment_environment=c.environment where s.singleton and s.payments_ready;
 if not found or not cfg.auto_enabled or cfg.environment is distinct from 'test' then return null;end if;
 h:=extract(hour from now() at time zone 'America/Sao_Paulo')::int;
 if mod((h+20),cfg.frequency_hours)<>0 then return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='neo_installment_cron_secret' limit 1;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='neo_installment_cron_endpoint' limit 1;
 if length(coalesce(secret,''))<32 or coalesce(endpoint,'') <> 'https://qnuluspqfazdppciermw.supabase.co/functions/v1/shop-integrations' then return null;end if;
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-neo-installment-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $$;
revoke all on function neo_private.shop_installment_schedule_v1() from public,anon,authenticated,service_role;
-- 01,07,13,19 UTC -> 22,04,10,16 BRT. The function checks the configured interval; default only 04:00.
-- Register inactive in the same transaction. Explicit release gate required to enable.
select cron.alter_job(cron.schedule('neo-shop-installments-v1','0 1,7,13,19 * * *','select neo_private.shop_installment_schedule_v1()'),active:=false);
commit;
