-- Run verify-test-integration.sql first against the confirmed Teste project.
begin read only;
do $$
begin
  if to_regclass('neo_private.shop_stock_journal') is not null
      or to_regprocedure('public.neo_shop_reconciliation_v1(text,jsonb)') is not null then
    raise exception '010.06 already present';
  end if;
  if to_regprocedure('neo_private.shop_cost_append_only()') is null
     or to_regclass('neo_private.shop_sale_cost_snapshots') is null
     or to_regprocedure('public.neo_shop_payment_event_v2(uuid,text,text,bigint,text,text)') is null then
    raise exception '010.06 dependency missing';
  end if;
end $$;
select p.oid::regprocedure,md5(pg_get_functiondef(p.oid)) as fingerprint
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','neo_private')
  and p.proname in ('neo_shop','shop_expire','neo_shop_payment_event_v2','neo_shop_payment_event_v22')
order by 1;
commit;
