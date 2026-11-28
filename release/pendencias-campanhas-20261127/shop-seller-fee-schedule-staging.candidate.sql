-- Teste only. Preserve nonce and dedicated endpoint; wake when either quote or fee sync is due.
CREATE OR REPLACE FUNCTION neo_private.installment_job_schedule_v1()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare cfg neo_private.shop_installment_config_v1; nonce text; request_id bigint;
begin
 perform pg_advisory_xact_lock(642917367);
 select c.* into cfg from neo_private.shop_installment_config_v1 c join neo_private.shop_settings s on s.singleton and s.payments_ready and s.payment_environment=c.environment where c.environment='test';
 if not found or neo_private.shop_installment_revision_v1('test') is null then return null;end if;
 if not (cfg.auto_enabled and (cfg.lease_until is null or cfg.lease_until<=now()) and (cfg.retry_after is null or cfg.retry_after<=now()) and (cfg.last_attempt is null or cfg.last_attempt<=now()-make_interval(hours=>cfg.frequency_hours)+interval '5 minutes'))
 and not exists(select 1 from neo_private.shop_fee_sync_v1 f where f.environment='test' and f.enabled and (f.lease_until is null or f.lease_until<=now()) and (f.last_attempt is null or f.last_attempt<=now()-interval '24 hours')) then return null;end if;
 delete from neo_private.installment_job_nonce_v1 where expires_at<=now();
 if exists(select 1 from neo_private.installment_job_nonce_v1) then return null;end if;
 nonce:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into neo_private.installment_job_nonce_v1(token_hash,expires_at) values(sha256(convert_to(nonce,'UTF8')),now()+interval '2 minutes');
 select net.http_post(url:='https://qnuluspqfazdppciermw.supabase.co/functions/v1/shop-installment-scheduled',headers:=jsonb_build_object('Content-Type','application/json','x-neo-job-nonce',nonce),body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $function$
;
