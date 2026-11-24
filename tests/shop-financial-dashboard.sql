insert into auth.users(id)
values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
       ('00000000-0000-0000-0000-000000000003');
insert into neo_private.admin_members values ('00000000-0000-0000-0000-000000000001');
insert into neo_private.community_moderators(user_id) values ('00000000-0000-0000-0000-000000000003');
insert into neo_private.shop_products(id,name,description,category,price_cents,stock,active)
values ('00000000-0000-0000-0000-000000000010','Produto A','','Categoria A',2000,3,true),
       ('00000000-0000-0000-0000-000000000011','Produto B','','Categoria B',1000,10,true);
insert into neo_private.shop_orders(id, request_key, items, address, subtotal_cents, shipping_cents,
  discount_cents, total_cents, status, created_at)
select ('00000000-0000-0000-0000-0000000000'||i)::uuid,gen_random_uuid(),
  '[{"product_id":"00000000-0000-0000-0000-000000000010","name":"Produto A histórico","quantity":2,"unit_price_cents":100},{"product_id":"00000000-0000-0000-0000-000000000011","name":"Produto B histórico","quantity":1,"unit_price_cents":100}]',
  '{}',300,50,100,250,
  (array['paid','test_paid','pending','refunded','paid_review','charged_back','cancelled'])[i-19],
  '2026-01-02 02:59:59+00'::timestamptz
from generate_series(20,26) i;
update neo_private.shop_orders set environment='production' where status<>'test_paid';
update neo_private.shop_orders set payment_id = '123' where status='paid_review';
insert into neo_private.shop_payments(payment_id,order_id,status,amount_cents)
select payment_id,id,'partially_refunded',250 from neo_private.shop_orders where status='paid_review';
insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version,unit_cost_brl_cents)
select id,1,1,0 from neo_private.shop_orders where status='paid';

begin read only;
do $$
declare
  ids uuid[] := array['00000000-0000-0000-0000-000000000002'::uuid,'00000000-0000-0000-0000-000000000003'::uuid,null];
  identity uuid;
  filters jsonb := '{"from":"2026-01-01","to":"2026-01-01"}';
  result jsonb;
begin
  assert not has_function_privilege('anon','public.neo_shop_financial_dashboard_v1(jsonb)','EXECUTE');
  assert not has_function_privilege('service_role','public.neo_shop_financial_dashboard_v1(jsonb)','EXECUTE');
  assert not has_table_privilege('authenticated','neo_private.shop_sale_cost_snapshots','SELECT');
  set local role authenticated;
  foreach identity in array ids loop
    perform set_config('request.jwt.claim.sub',coalesce(identity::text,''),true);
    begin
      perform public.neo_shop_financial_dashboard_v1(filters);
      raise exception 'unauthorized session allowed';
    exception when insufficient_privilege then null;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  result := public.neo_shop_financial_dashboard_v1(filters);
  assert result->'sales' @> '{"orders":1,"units":3,"covered_units":2,"gross_cents":"300","commercial_cents":"200","discount_cents":"100","shipping_cents":"50","known_cmv_cents":"0","profit_cents":null,"margin_percent":null}';
  assert result->'stock' @> '{"units":13,"alert_count":1}';
  assert result->'states' @> '[{"environment":"test","status":"test_paid","orders":1},{"status":"partially_refunded","orders":1},{"status":"charged_back","orders":1},{"status":"refunded","orders":1},{"status":"pending","orders":1}]';
  assert result->'details' @> '[{"key":"2026-01-01","commercial_cents":"200"}]';
  result := public.neo_shop_financial_dashboard_v1(filters || '{"category":"Categoria A","group_by":"product","fulfillment":"processing"}');
  assert result->'sales' @> '{"gross_cents":"200","discount_cents":"67","commercial_cents":"133","units":2,"known_cmv_cents":"0","profit_cents":"133","margin_percent":"100.00","shipping_cents":null}';
  assert result->'details' @> '[{"label":"Produto A histórico","commercial_cents":"133"}]';
  result := public.neo_shop_financial_dashboard_v1(filters || '{"product_id":"00000000-0000-0000-0000-000000000011","group_by":"category"}');
  assert result->'sales' @> '{"discount_cents":"33","commercial_cents":"67","known_cmv_cents":null,"profit_cents":null}';
  assert result->'details' @> '[{"label":"Categoria B"}]';
  result := public.neo_shop_financial_dashboard_v1(filters || '{"environment":"test"}');
  assert result->'sales' @> '{"orders":0,"commercial_cents":"0","profit_cents":null}';
  assert jsonb_array_length(result->'states')=1;
  result := public.neo_shop_financial_dashboard_v1(filters || '{"status":"refunded"}');
  assert result->'sales'->>'orders' = '0' and result->'states' @> '[{"status":"refunded","orders":1}]';
  result := public.neo_shop_financial_dashboard_v1('{"from":"2026-01-02","to":"2026-01-02"}');
  assert result->'states' = '[]';
  begin
    perform public.neo_shop_financial_dashboard_v1('{"from":"2020-01-01","to":"2026-01-01"}');
    raise exception 'unbounded date interval accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
commit;

-- More groups than a page. Cards must still reflect every order in range.
insert into neo_private.shop_orders(request_key, items, address, subtotal_cents, total_cents, shipping_cents, status, created_at)
select gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-000000000010","quantity":1,"unit_price_cents":100}]',
  '{}',100,100,0,'paid','2026-02-01 15:00+00'::timestamptz + i*interval '1 day'
from generate_series(0,24) i;
update neo_private.shop_orders set environment='production' where created_at >= '2026-02-01';

insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version,unit_cost_brl_cents)
select id,1,1,0.5 from neo_private.shop_orders where created_at='2026-02-01 15:00+00';

begin read only;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
declare
  first_page jsonb := public.neo_shop_financial_dashboard_v1('{"from":"2026-02-01","to":"2026-02-25"}');
  second_page jsonb := public.neo_shop_financial_dashboard_v1('{"from":"2026-02-01","to":"2026-02-25","page":2}');
begin
  assert first_page->'sales' = second_page->'sales';
  assert public.neo_shop_financial_dashboard_v1('{"from":"2026-02-01","to":"2026-02-01"}')->'sales'
    @> '{"known_cmv_cents":"1","profit_cents":"99","margin_percent":"99.00"}';
  assert first_page->'sales' @> '{"orders":25,"gross_cents":"2500"}';
  assert first_page->>'detail_pages' = '2' and jsonb_array_length(first_page->'details')=20;
  assert jsonb_array_length(second_page->'details')=5;
end $$;
commit;

do $$
begin
  assert (select sum(stock) from neo_private.shop_products)=13;
  assert (select count(*) from neo_private.shop_orders)=32;
  assert (select count(*) from neo_private.shop_sale_cost_snapshots)=2;
end $$;
\echo OK: read-only ACL, filters, refund status, exact discount allocation, historical cost coverage, stock and pagination
