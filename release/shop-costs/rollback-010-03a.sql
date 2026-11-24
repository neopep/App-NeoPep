begin;

select pg_advisory_xact_lock(642917200);

lock table neo_private.shop_sale_cost_snapshots, neo_private.shop_stock_movements,
  neo_private.shop_acquisitions, neo_private.shop_fx_rates in access exclusive mode;

do $$
begin
  if exists (select 1 from neo_private.shop_sale_cost_snapshots)
     or exists (select 1 from neo_private.shop_stock_movements)
     or exists (select 1 from neo_private.shop_acquisitions)
     or exists (select 1 from neo_private.shop_fx_rates) then
    raise exception 'shop_cost_rollback_requires_preserving_financial_history';
  end if;
end
$$;

drop function neo_private.shop_record_stock_adjustment(uuid, uuid, integer, integer, text, uuid, uuid);
drop view neo_private.shop_acquisition_costs;
drop table neo_private.shop_sale_cost_snapshots, neo_private.shop_stock_movements,
  neo_private.shop_acquisitions, neo_private.shop_fx_rates;
drop function neo_private.shop_cost_append_only(), neo_private.shop_validate_sale_cost_snapshot();

commit;
