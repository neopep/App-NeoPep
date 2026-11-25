begin read only;
do $$
begin
  if to_regprocedure('public.neo_shop_bulk_v1(text,jsonb)') is not null or
     to_regclass('neo_private.shop_bulk_batches') is not null then
    raise exception '011 already present';
  end if;
  if to_regclass('neo_private.admin_members') is null
     or to_regclass('neo_private.shop_stock_movements') is null
     or to_regclass('neo_private.shop_stock_journal') is null
     or to_regclass('neo_private.shop_product_visibility_members') is null
     or to_regclass('public.neo_shop_visibility_events') is null
     or not exists(select 1 from pg_trigger where tgrelid='neo_private.shop_products'::regclass
       and tgname='shop_01006_stock' and tgenabled in ('O','A')) then
    raise exception 'Incompatible Shop schema or disabled 010.06 journaling';
  end if;
end $$;
select p.oid::regprocedure,md5(pg_get_functiondef(p.oid)) as fingerprint
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','neo_private')
  and p.proname in ('neo_shop','shop_expire','neo_shop_payment_event_v2','neo_shop_payment_event_v22')
order by 1;
commit;
