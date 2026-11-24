insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'), ('00000000-0000-0000-0000-000000000003');
insert into neo_private.community_moderators(user_id) values ('00000000-0000-0000-0000-000000000003');
insert into neo_private.admin_members(user_id) values ('00000000-0000-0000-0000-000000000001');
insert into neo_private.shop_products(id,name,description,category,price_cents,stock)
values ('00000000-0000-0000-0000-000000000010','Produto teste','','Teste',1000,3);
insert into neo_private.shop_orders(id,request_key,items,address,subtotal_cents,shipping_cents,total_cents,status,environment)
values ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000021',
  '[{"product_id":"00000000-0000-0000-0000-000000000010","quantity":3,"unit_price_cents":1000}]','{}',3000,0,3000,'paid','production');
update neo_private.shop_orders set environment='production' where id='00000000-0000-0000-0000-000000000020';
insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version,unit_cost_brl_cents)
values ('00000000-0000-0000-0000-000000000020',1,1,20);

do $$
declare
  product constant uuid := '00000000-0000-0000-0000-000000000010';
  admin constant uuid := '00000000-0000-0000-0000-000000000001';
  member constant uuid := '00000000-0000-0000-0000-000000000002';
  args jsonb := jsonb_build_object('product_id',product,'entry_kind','cost_only','currency','BRL',
    'quantity',3,'unit_cost','0.00','acquired_on','2026-01-01','expected_stock',3,'request_key',gen_random_uuid());
  result jsonb;
  copy_id uuid;
  action text;
begin
  assert not has_function_privilege('anon','public.neo_shop_costs_v1(text,jsonb)','EXECUTE');
  assert not has_function_privilege('service_role','public.neo_shop_costs_v1(text,jsonb)','EXECUTE');
  assert not has_table_privilege('authenticated','neo_private.shop_acquisitions','SELECT,INSERT,UPDATE,DELETE');

  perform set_config('request.jwt.claim.sub','',true);
  for i in 1..2 loop
    if i = 1 then
      set local role anon;
    else
      set local role authenticated;
    end if;
    foreach action in array array['read','register'] loop
      begin
        perform public.neo_shop_costs_v1(action,args);
        raise exception 'unauthenticated % permitted', action;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end loop;

  perform set_config('request.jwt.claim.sub',member::text,true);
  set local role authenticated;
  begin
    perform public.neo_shop_costs_v1('read',args);
    raise exception 'member can read cost';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.neo_shop_costs_v1('register',args);
    raise exception 'member can write cost';
  exception when insufficient_privilege then null;
  end;
  -- A moderator may pass legacy neo_admin_access(), but must not read costs.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  assert public.neo_admin_access();
  begin
    perform public.neo_shop_costs_v1('read',args);
    raise exception 'community moderator can read financial costs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.neo_shop_costs_v1('register',args);
    raise exception 'community moderator can write financial costs';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  result := public.neo_shop_costs_v1('read',args);
  assert result->'history' = '[]';
  result := public.neo_shop_costs_v1('register',args);
  assert result->>'stock' = '3' and result->'history'->0->>'unit_cost' = '0';
  assert result = public.neo_shop_costs_v1('register',args);
  begin
    perform public.neo_shop_costs_v1('register',args || '{"unit_cost":"0.001"}');
    raise exception 'mutated request accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.neo_shop_costs_v1('register',args || jsonb_build_object(
      'request_key',gen_random_uuid(),'entry_kind','acquisition','quantity',1000000,'revision',result->'revision'));
    raise exception 'overflow accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.neo_shop_costs_v1('register',args || jsonb_build_object(
      'request_key',gen_random_uuid(),'currency','USD','revision',result->'revision'));
    raise exception 'USD cost without FX accepted';
  exception when invalid_parameter_value then null;
  end;
  -- Verify BRL with all supported decimals and roll this fixture back for the concurrent USD test.
  begin
    result := public.neo_shop_costs_v1('register',args || jsonb_build_object(
      'request_key',gen_random_uuid(),'unit_cost','1.00123456','revision',result->'revision'));
    assert result->'history'->0->>'brl_unit' = '1.00123456';
    assert result->'history'->0->>'brl_total' = '3.00370368';
    assert result->>'stock' = '3';
    raise exception using errcode = 'Z0104', message = 'rollback BRL precision fixture';
  exception when sqlstate 'Z0104' then null;
  end;
  copy_id := (public.neo_shop('duplicate_product',jsonb_build_object('id',product,'request_key',gen_random_uuid()))->>'id')::uuid;
  result := public.neo_shop_costs_v1('read',jsonb_build_object('product_id',copy_id));
  assert result->'history' = '[]' and result->>'stock' = '3';
end $$;
\echo OK: admin, member, moderator, anonymous, precision BRL, unknown and zero, replay conflict, duplicate isolation
