-- Stop new instrumented writes and preserve all history, including valuation.
-- Re-enable only in a reviewed release: valuation after a gap needs reconciliation.
begin;
select pg_advisory_xact_lock(642917200);
revoke execute on function public.neo_shop_reconciliation_v1(text,jsonb) from authenticated;
drop trigger shop_01006_payment on neo_private.shop_payments;
drop trigger shop_01006_order on neo_private.shop_orders;
drop trigger shop_01006_valuation on neo_private.shop_stock_movements;
drop trigger shop_01006_stock on neo_private.shop_products;
notify pgrst,'reload schema';
commit;
