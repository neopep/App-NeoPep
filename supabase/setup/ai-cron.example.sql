-- OPTIONAL: run only after deploying/testing ai-reply and reviewing API costs.
-- Requires pg_cron, pg_net and the cron secret saved in Vault as neo_ai_cron_secret.
-- Set NEO_AI_CRON_SECRET in Edge Secrets to the same value. Never put it in browser code.
-- Keep AI disabled until the administrator deliberately activates it in Settings.
select cron.schedule('neo-ai-worker','* * * * *',$job$
 select net.http_post(
  url:='https://cpslafpzjtbpmoxxysaa.supabase.co/functions/v1/ai-reply',
  headers:=jsonb_build_object('Content-Type','application/json','x-neo-ai-secret',(select decrypted_secret from vault.decrypted_secrets where name='neo_ai_cron_secret' limit 1)),
  body:='{}'::jsonb
 );
$job$);
-- To stop the recovery schedule: select cron.unschedule('neo-ai-worker');
