do $$
declare
  admin constant uuid := '00000000-0000-0000-0000-000000000001';
  product constant uuid := '00000000-0000-0000-0000-000000000010';
  unknown_product constant uuid := '00000000-0000-0000-0000-000000000011';
  first_order uuid;
  second_order uuid;
  identity text;
  action text;
  result jsonb;
  evidence jsonb;
  return_request jsonb;
  revision uuid;
begin
  assert (select count(*) from neo_private.shop_orders)=1;
  select id into strict first_order from neo_private.shop_orders;
  assert (select stock from neo_private.shop_products where id=product)=0;
  assert (select count(*) from neo_private.shop_stock_movements where order_id=first_order and kind='reserve')=1;

  perform set_config('request.jwt.claim.sub',admin::text,true);
  select id into strict revision from neo_private.shop_acquisitions where product_id=product;
  perform public.neo_shop_costs_v1('register',jsonb_build_object('product_id',product,'request_key',gen_random_uuid(),
    'revision',revision,'expected_stock',0,'entry_kind','acquisition','currency','USD','unit_cost','1',
    'quantity',2,'acquired_on','2026-01-01','fx_rate','5.25','fx_source','Fixture','fx_on','2026-01-01'));
  assert (select unit_cost from neo_private.shop_stock_valuation order by journal_id desc limit 1)=525;

  -- A failed payment attempt must not leave audit rows or change stock.
  begin
    perform public.neo_shop_payment_event_v2(first_order,'100','approved',1,'production','pix');
    raise exception using errcode='Z0106', message='invalid payment accepted';
  exception when raise_exception then null;
  end;
  assert (select count(*) from neo_private.shop_payments)=0;
  assert (select stock from neo_private.shop_products where id=product)=2;

  perform public.neo_shop_payment_event_v2(first_order,'100','approved',1000,'production','pix');
  perform public.neo_shop_payment_event_v2(first_order,'100','approved',1000,'production','pix');
  assert (select stock from neo_private.shop_products where id=product)=2;
  assert (select count(*) from neo_private.shop_sale_cost_snapshots where order_id=first_order
    and unit_cost_brl_cents=0 and reservation_movement_id is not null)=1;
  assert (select count(*) from neo_private.shop_stock_movements where order_id=first_order and kind='sale' and delta=0)=1;
  assert (select count(*) from neo_private.shop_reconciliation_events where order_id=first_order and event_type='payment')=1;

  evidence:=jsonb_build_object('order_id',first_order,'effective_on','2026-01-01','amount_cents',0);
  foreach action in array array['fee','shipping_cost','tax','other'] loop
    perform public.neo_shop_reconciliation_v1('record_evidence',evidence||jsonb_build_object(
      'request_key',gen_random_uuid(),'kind',action,'source_ref','Fixture '||action));
  end loop;
  result:=public.neo_shop_reconciliation_v1('read',jsonb_build_object('order_id',first_order));
  assert result @> '{"expense_coverage":4,"estimated_net_cents":"1000"}';

  update neo_private.shop_orders set fulfillment='dispatched' where id=first_order;
  perform public.neo_shop_payment_event_v2(first_order,'100','partially_refunded',1000,'production','pix');
  assert (select status from neo_private.shop_orders where id=first_order)='paid_review';
  perform public.neo_shop_payment_event_v2(first_order,'100','refunded',1000,'production','pix');
  perform public.neo_shop_payment_event_v2(first_order,'100','refunded',1000,'production','pix');
  assert (select stock from neo_private.shop_products where id=product)=2;
  return_request:=jsonb_build_object('order_id',first_order,'request_key',gen_random_uuid(),
    'line_position',1,'units',1,'source_ref','Recebimento físico sintético');
  assert public.neo_shop_reconciliation_v1('confirm_return',return_request) @> '{"ok":true}';
  assert public.neo_shop_reconciliation_v1('confirm_return',return_request) @> '{"ok":true}';
  assert (select stock from neo_private.shop_products where id=product)=3;
  assert (select unit_cost from neo_private.shop_stock_valuation order by journal_id desc limit 1)=350;
  begin
    perform public.neo_shop_reconciliation_v1('confirm_return',return_request||jsonb_build_object('request_key',gen_random_uuid()));
    raise exception 'second physical return accepted';
  exception when invalid_parameter_value then null;
  end;

  second_order:=shop_fixture_buy(3,unknown_product);
  update neo_private.shop_orders set expires_at=now()-interval '1 minute' where id=second_order;
  perform neo_private.shop_expire();
  perform neo_private.shop_expire();
  assert (select stock from neo_private.shop_products where id=unknown_product)=1;
  perform public.neo_shop_payment_event_v2(second_order,'200','approved',1000,'production','pix');
  assert (select stock from neo_private.shop_products where id=unknown_product)=0;
  assert (select count(*) from neo_private.shop_sale_cost_snapshots where order_id=second_order
    and unit_cost_brl_cents is null and reservation_movement_id is not null)=1;
  perform public.neo_shop_payment_event_v2(second_order,'200','charged_back',1000,'production','pix');
  assert (select stock from neo_private.shop_products where id=unknown_product)=0;

  -- Preserve and surface the legacy refunded-before-dispatch release.
  second_order:=shop_fixture_buy(2,product);
  perform public.neo_shop_payment_event_v2(second_order,'300','approved',1000,'production','pix');
  assert (select unit_cost_brl_cents from neo_private.shop_sale_cost_snapshots where order_id=second_order)=350;
  perform public.neo_shop_payment_event_v2(second_order,'300','refunded',1000,'production','pix');
  assert (select stock from neo_private.shop_products where id=product)=3;
  assert (select count(*) from neo_private.shop_reconciliation_events
    where order_id=second_order and event_type='legacy_refund_release')=1;

  second_order:=shop_fixture_buy(2,product);
  perform public.neo_shop('cancel_order',jsonb_build_object('id',second_order));
  assert (select stock from neo_private.shop_products where id=product)=3;
  assert (select count(*) from neo_private.shop_stock_movements where order_id=second_order and kind='release')=1;

  -- Recovery after abort of an otherwise valid legacy reservation.
  begin
    perform shop_fixture_buy(2,product);
    raise exception using errcode='Z0107',message='simulated fault after reservation';
  exception when sqlstate 'Z0107' then null;
  end;
  assert (select stock from neo_private.shop_products where id=product)=3;
  assert (select count(*) from neo_private.shop_orders)=4;

  set local role authenticated;
  foreach identity in array array['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',''] loop
    perform set_config('request.jwt.claim.sub',identity,true);
    foreach action in array array['read','record_evidence','confirm_return'] loop
      begin
        perform public.neo_shop_reconciliation_v1(action,return_request);
        raise exception 'unauthorized financial access';
      exception when insufficient_privilege then null;
      end;
    end loop;
  end loop;
end $$;
