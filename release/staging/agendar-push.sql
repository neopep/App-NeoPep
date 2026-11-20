-- Run after the manual push test in staging and only with an approved cadence.
begin;
do $preflight$
begin
  if current_setting('app.settings.supabase_url', true) is distinct from 'https://qnuluspqfazdppciermw.supabase.co'
     or to_regclass('cron.job') is null
     or position('https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch'
       in pg_get_functiondef('neo_private.push_dispatch_wake()'::regprocedure)) = 0 then
    raise exception 'Confira o alvo, pg_cron e a ativação de push do staging.';
  end if;
end
$preflight$;
select cron.schedule('neo-staging-push-fallback', '*/5 * * * *', 'select neo_private.push_dispatch_wake()');
commit;
