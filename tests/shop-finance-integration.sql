-- Runs after the isolated cost editor scenario, on the same product and history.
begin read only;
set local role authenticated;

do $$
declare
  product constant uuid := '00000000-0000-0000-0000-000000000010';
  filters jsonb := '{"from":"2000-01-01","to":"2000-01-31"}';
  history jsonb;
  dashboard jsonb;
  identity text;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  history := public.neo_shop_costs_v1('read',jsonb_build_object('product_id',product));
  dashboard := public.neo_shop_financial_dashboard_v1(filters || jsonb_build_object('product_id',product));
  assert history->>'stock' = '5' and dashboard->'stock'->>'units' = '5';
  assert history->'history' @> '[{"unit_cost":"0","entry_kind":"cost_only"},
    {"currency":"USD","fx_rate":"5.1234567891","fx_source":"Fixture","brl_total":"10.259564007827102592"}]';
  assert dashboard->'sales' @> '{"orders":0,"known_cmv_cents":null,"profit_cents":null}';
  foreach identity in array array[
    '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'
  ] loop
    perform set_config('request.jwt.claim.sub',identity,true);
    begin
      perform public.neo_shop_costs_v1('read',jsonb_build_object('product_id',product));
      raise exception 'financial history accepted unauthorized user';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.neo_shop_financial_dashboard_v1(filters);
      raise exception 'financial dashboard accepted unauthorized user';
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

commit;

do $$
begin
  assert (select stock from neo_private.shop_products
    where id='00000000-0000-0000-0000-000000000010')=5;
  assert (select total_cents from neo_private.shop_orders)=3000;
  assert (select unit_cost_brl_cents from neo_private.shop_sale_cost_snapshots)=20;
  assert (select count(*) from neo_private.shop_stock_movements)=1;
end $$;
\echo OK: os dois contratos coexistem e o dashboard reflete o saldo sem gravar dados
