-- Disable the entry point and keep batches, financial history, and stock movements.
begin;
select pg_advisory_xact_lock(642917200);
revoke execute on function public.neo_shop_bulk_v1(text,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;
